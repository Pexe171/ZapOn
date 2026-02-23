import { Request, Response } from "express";
import AppError from "../errors/AppError";
import fs from "fs";
import GetTicketWbot from "../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import path from "path";
import { isNil } from "lodash";
import { Mutex } from "async-mutex";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import { sendFacebookMessageMedia } from "../services/FacebookServices/sendFacebookMessageMedia";
import sendFaceMessage from "../services/FacebookServices/sendFacebookMessage";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import ListMessagesServiceAll from "../services/MessageServices/ListMessagesServiceAll";
import ShowContactService from "../services/ContactServices/ShowContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import Contact from "../models/Contact";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CompaniesSettings from "../models/CompaniesSettings";
import {
  verifyMessageFace,
  verifyMessageMedia
} from "../services/FacebookServices/facebookMessageListener";
import EditWhatsAppMessage from "../services/MessageServices/EditWhatsAppMessage";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import {
  generateWAMessageFromContent,
  generateWAMessageContent,
  proto,
  downloadMediaMessage,
  getContentType
} from "baileys";

import SendWhatsAppReaction from "../services/WbotServices/SendWhatsAppReaction";
import TranscribeAudioMessageService from "../services/MessageServices/TranscribeAudioMessageService";
import ShowMessageService, {
  GetWhatsAppFromMessage
} from "../services/MessageServices/ShowMessageService";

type IndexQuery = {
  pageNumber: string;
  ticketTrakingId: string;
  selectedQueues?: string;
};

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  isPrivate?: string;
  vCard?: Contact;
};

// Função utilitária para extrair o campo body de mensagens
const extractMessageBody = (
  msg: any,
  fallback: string = "Mensagem interativa"
): string => {
  if (msg.message?.interactiveMessage?.body?.text) {
    return msg.message.interactiveMessage.body.text;
  }
  if (msg.message?.listMessage?.description) {
    return msg.message.listMessage.description;
  }
  if (
    msg.message?.interactiveMessage?.nativeFlowMessage?.buttons[0]
      ?.buttonParamsJson
  ) {
    try {
      const params = JSON.parse(
        msg.message.interactiveMessage.nativeFlowMessage.buttons[0]
          .buttonParamsJson
      );
      return (
        params.order?.items[0]?.name || params.display_text || fallback
      );
    } catch {
      return fallback;
    }
  }
  return msg.message?.conversation || fallback;
};

// Função para extrair dados de localização da mensagem
const extractLocationData = (message: any): { 
  latitude: number, 
  longitude: number, 
  name?: string, 
  address?: string 
} | null => {
  try {
    const msgData = typeof message.dataJson === 'string' 
      ? JSON.parse(message.dataJson) 
      : message.dataJson || message;

    // Verificar diferentes formatos de mensagem de localização
    if (msgData.message?.locationMessage) {
      const locMsg = msgData.message.locationMessage;
      return {
        latitude: locMsg.degreesLatitude,
        longitude: locMsg.degreesLongitude,
        name: locMsg.name || 'Localização',
        address: locMsg.address || ''
      };
    }
    
    if (msgData.message?.liveLocationMessage) {
      const locMsg = msgData.message.liveLocationMessage;
      return {
        latitude: locMsg.degreesLatitude,
        longitude: locMsg.degreesLongitude,
        name: locMsg.caption || 'Localização em tempo real',
        address: ''
      };
    }

    // Verificar se já é um objeto com latitude/longitude
    if (msgData.latitude && msgData.longitude) {
      return {
        latitude: msgData.latitude,
        longitude: msgData.longitude,
        name: msgData.name || 'Localização',
        address: msgData.address || ''
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao extrair dados de localização:', error);
    return null;
  }
};

// Função para gerar IDs únicos
const generateRandomCode = (length: number = 11): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

// Função para formatar número de telefone
const formatPhoneNumber = (number: string): string => {
  if (!number) {
    throw new AppError("Número não fornecido", 400);
  }

  // Remove todos os caracteres não numéricos
  let cleaned = number.replace(/\D/g, "");

  // Se o número já começar com 55 e tiver o DDD, apenas valida
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return cleaned;
  }

  // Se não tiver código do país, adiciona 55 (Brasil)
  if (!cleaned.startsWith("55") && cleaned.length >= 10) {
    cleaned = "55" + cleaned;
  }

  // Valida o comprimento do número
  if (cleaned.length < 12 || cleaned.length > 13) {
    throw new AppError(
      `Número de contato inválido: ${number}. Formato esperado: 55DDDNUMERO (12-13 dígitos)`,
      400
    );
  }

  return cleaned;
};

// Função para validar e formatar número para WhatsApp
const validateAndFormatWhatsAppNumber = (number: string): string => {
  const formattedNumber = formatPhoneNumber(number);

  // Verifica se o número tem o formato correto
  if (!/^55\d{10,11}$/.test(formattedNumber)) {
    throw new AppError(
      `Número de WhatsApp inválido: ${number}. Use o formato: 5531999999999`,
      400
    );
  }

  return formattedNumber;
};

// Adicionar reação
export const addReaction = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { messageId } = req.params;
    const { type } = req.body;
    const { companyId, id } = req.user;

    const message = await Message.findByPk(messageId);
    if (!message) {
      throw new AppError("Mensagem não encontrada", 404);
    }

    const ticket = await Ticket.findByPk(message.ticketId, {
      include: ["contact"]
    });
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    const reactionResult = await SendWhatsAppReaction({
      messageId,
      ticket,
      reactionType: type
    });

    const io = getIO();
    io.to(message.ticketId.toString()).emit(
      `company-${companyId}-appMessage`,
      {
        action: "update",
        message
      }
    );

    return res.status(200).json({
      message: "Reação adicionada com sucesso!",
      reactionResult
    });
  } catch (error) {
    console.error("Erro ao adicionar reação:", error);
    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erro ao adicionar reação",
      error: String(error)
    });
  }
};

// Enviar mensagem de lista
export const sendListMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, text, buttonText, footer, sections } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);

    // Validate input
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      throw new AppError("Sections must be a non-empty array", 400);
    }
    if (
      !sections.every(
        (section: any) =>
          Array.isArray(section.rows) && section.rows.length > 0
      )
    ) {
      throw new AppError(
        "Each section must have at least one row",
        400
      );
    }

    // Format sections for Baileys MD
    const formattedSections = sections.map((section: any) => ({
      title: section.title || "Section",
      rows: section.rows.map((row: any) => ({
        rowId: row.id || generateRandomCode(10),
        title: row.title || "Option",
        description: row.description || ""
      }))
    }));

    const listMessage: proto.IMessage = {
      listMessage: {
        title: title || "Lista de Opções",
        description: text || "Selecione uma opção",
        buttonText: buttonText || "Selecionar",
        footerText: footer || "",
        sections: formattedSections,
        listType: 1 // Single-select list
      }
    };

    console.debug(
      "Sending list message:",
      JSON.stringify(listMessage, null, 2)
    );

    const newMsg = generateWAMessageFromContent(number, listMessage, {
      userJid: botNumber
    });

    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!
    });

    // Preencher o campo body para salvar no banco
    const messageBody = text || title || "Lista interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "listMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "List message sent successfully", newMsg });
  } catch (err: any) {
    console.error("Error sending list message:", err);
    throw new AppError(`Error sending list message: ${err.message}`, 500);
  }
};

// Enviar mensagem de cópia
export const sendCopyMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    const copyMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Botão copiar"
            },
            footer: {
              text: description || "Botão copiar"
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || "Botão copiar",
                    copy_code: copyText || "Botão copiar"
                  })
                }
              ]
            }
          }
        }
      }
    };

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const newMsg = generateWAMessageFromContent(number, copyMessage, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem de cópia interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "Copy message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem de cópia:", error);
    throw new AppError("Error sending copy message", 500);
  }
};

// Enviar mensagem de chamada
export const sendCALLMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    const callMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Botão de chamada"
            },
            footer: {
              text: description || "Botão de chamada"
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_call",
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || "Botão de chamada",
                    phone_number: copyText || "Botão de chamada"
                  })
                }
              ]
            }
          }
        }
      }
    };

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const newMsg = generateWAMessageFromContent(number, callMessage, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem de chamada interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "Call message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem de chamada:", error);
    throw new AppError("Error sending call message", 500);
  }
};

// Enviar mensagem de URL
export const sendURLMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { image, title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    let urlMessage: proto.IMessage;

    if (image) {
      if (!image.includes("base64,")) {
        throw new AppError("Invalid base64 image format", 400);
      }
      const base64Image = image.split(",")[1];
      const imageMessageContent = await generateWAMessageContent(
        {
          image: {
            url: `data:image/png;base64,${base64Image}`
          }
        },
        { upload: wbot.waUploadToServer! }
      );

      urlMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: title || "Botão URL"
              },
              footer: {
                text: description || "Botão URL"
              },
              header: {
                imageMessage: imageMessageContent.imageMessage,
                hasMediaAttachment: true
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: buttonText || "Botão URL",
                      url: copyText || "https://example.com"
                    })
                  }
                ]
              }
            }
          }
        }
      };
    } else {
      urlMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: title || "Botão URL"
              },
              footer: {
                text: description || "Botão URL"
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: buttonText || "Botão URL",
                      url: copyText || "https://example.com"
                    })
                  }
                ]
              }
            }
          }
        }
      };
    }

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const newMsg = generateWAMessageFromContent(number, urlMessage, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem URL interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "URL message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem URL:", error);
    throw new AppError("Error sending URL message", 500);
  }
};

// Enviar mensagem PIX
export const sendPIXMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const {
    title,
    description,
    copyButtonText,
    sendKey
  }: {
    title: string;
    description?: string;
    copyButtonText?: string;
    sendKey: string;
  } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    // Validate input
    if (!sendKey || !title) {
      throw new AppError("Title and PIX key are required", 400);
    }

    // Validate PIX key format
    const validatePixKey = (key: string): boolean => {
      return (
        /^\+55\d{10,11}$/.test(key) || // PHONE
        /^\d{11}$/.test(key) || // CPF
        /^\d{14}$/.test(key) || // CNPJ
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) || // EMAIL
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          key
        ) // EVP
      );
    };

    if (!validatePixKey(sendKey)) {
      throw new AppError("Invalid PIX key format", 400);
    }

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);

    const interactiveMsg = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Copiar Chave PIX"
            },
            footer: {
              text: description || "Clique para copiar a chave PIX"
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: copyButtonText || "Copiar Chave PIX",
                    copy_code: sendKey
                  })
                }
              ]
            }
          }
        }
      }
    };

    const newMsg = generateWAMessageFromContent(number, interactiveMsg, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem PIX interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "Mensagem enviada com sucesso", newMsg });
  } catch (error: any) {
    console.error("Erro ao enviar a mensagem PIX:", error);
    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erro interno ao enviar a mensagem PIX",
      error: String(error)
    });
  }
};

/**
 * ✅ CORRIGIDO: Enviar Localização (latitude/longitude)
 * Rota: POST /messages/sendLocation/:ticketId
 * Body: { latitude, longitude, name?, address?, isPrivate? }
 */
export const sendLocation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const { latitude, longitude, name, address, isPrivate = "false" } = req.body as {
    latitude: number | string;
    longitude: number | string;
    name?: string;
    address?: string;
    isPrivate?: string;
  };

  try {
    const ticket = await ShowTicketService(ticketId, companyId);
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    // Se for privado, salva somente no banco
    if (ticket.channel === "whatsapp" && isPrivate === "true") {
      const body = `📍 ${name || 'Localização (privada)'}\nLat: ${latitude}\nLng: ${longitude}${address ? `\nEndereço: ${address}` : ''}`;

      const messageData = {
        wid: `PVTLOC${new Date().getTime()}`,
        ticketId: ticket.id,
        contactId: undefined,
        body,
        fromMe: true,
        mediaType: "locationMessage",
        read: true,
        quotedMsgId: null,
        ack: 2,
        remoteJid: ticket.contact?.remoteJid,
        participant: null,
        dataJson: JSON.stringify({ 
          latitude, 
          longitude, 
          name: name || 'Localização',
          address: address || '',
          isPrivate: true 
        }),
        ticketTrakingId: null,
        isPrivate: true,
        companyId: ticket.companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await CreateMessageService({ messageData, companyId: ticket.companyId });
      return res.status(200).json({ message: "Localização enviada (privada)." });
    }

    // Envio real via WhatsApp
    if (ticket.channel !== "whatsapp") {
      throw new AppError("Envio de localização disponível apenas no WhatsApp.", 400);
    }

    const contact = ticket.contact || (await Contact.findByPk(ticket.contactId));
    if (!contact) {
      throw new AppError("Contato não encontrado", 404);
    }

    const wbot = await GetTicketWbot(ticket);
    const jid = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

    const latNum = typeof latitude === "string" ? Number(latitude) : latitude;
    const lngNum = typeof longitude === "string" ? Number(longitude) : longitude;

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new AppError("Latitude/Longitude inválidas", 400);
    }

    // Criar objeto de localização
    const locationData: any = {
      degreesLatitude: latNum,
      degreesLongitude: lngNum
    };

    // Adicionar nome e endereço se fornecidos
    if (name) locationData.name = name;
    if (address) locationData.address = address;

    // Envia localização
    const sent = await (wbot as any).sendMessage(jid, {
      location: locationData
    });

    // Salva no banco
    const messageBody = `📍 ${name || 'Localização'}\nLat: ${latNum}\nLng: ${lngNum}${address ? `\n${address}` : ''}`;

    const messageData = {
      wid: sent?.key?.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "locationMessage",
      read: true,
      ack: 1,
      remoteJid: jid,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify({
        ...sent,
        locationData: {
          latitude: latNum,
          longitude: lngNum,
          name: name || 'Localização',
          address: address || ''
        }
      }),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res.status(200).json({ 
      message: "Localização enviada com sucesso", 
      data: {
        id: sent?.key?.id,
        latitude: latNum,
        longitude: lngNum,
        name: name || 'Localização',
        address: address || ''
      }
    });
  } catch (error: any) {
    console.error("Erro ao enviar localização:", error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erro interno ao enviar localização",
      error: String(error)
    });
  }
};

// Transcrição de áudio
export const transcribeAudioMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fileName } = req.params;
  const { companyId } = req.user;

  try {
    const transcribeService = new TranscribeAudioMessageService();

    const result = await transcribeService.execute(fileName, companyId);

    // Service pode retornar { error } ou { transcribedText }
    if ("error" in result) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(`Erro ao transcrever a mensagem de áudio: ${error}`);

    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ error: error.message });
    }

    return res.status(500).json({
      error: "Erro interno ao transcrever a mensagem de áudio."
    });
  }
};

// Listar mensagens
export const index = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, selectedQueues: queueIdsStringified } =
    req.query as IndexQuery;
  const { companyId } = req.user;
  let queues: number[] = [];

  const user = await User.findByPk(req.user.id, {
    include: [{ model: Queue, as: "queues" }]
  });

  if (queueIdsStringified) {
    queues = JSON.parse(queueIdsStringified);
  } else {
    user!.queues.forEach(queue => {
      queues.push(queue.id);
    });
  }

  const { count, messages, ticket, hasMore } =
    await ListMessagesService({
      pageNumber,
      ticketId,
      companyId,
      queues,
      user: user!
    });

  if (ticket.channel === "whatsapp" && ticket.whatsappId) {
    await SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

// Função para obter nome e extensão do arquivo
function obterNomeEExtensaoDoArquivo(url: string): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const filename = pathname.split("/").pop() || "";
  const parts = filename.split(".");

  const nomeDoArquivo = parts[0];
  const extensao = parts[1] || "";

  return `${nomeDoArquivo}.${extensao}`;
}

// Armazenar mensagem
export const store = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg, vCard, isPrivate = "false" }: MessageData =
    req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);

  if (ticket.channel === "whatsapp" && ticket.whatsappId) {
    await SetTicketMessagesAsRead(ticket);
  }

  try {
    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File, index) => {
          if (ticket.channel === "whatsapp") {
            await SendWhatsAppMedia({
              media,
              ticket,
              body: Array.isArray(body) ? body[index] : body,
              isPrivate: isPrivate === "true",
              isForwarded: false
            });
          }

          if (["facebook", "instagram"].includes(ticket.channel)) {
            try {
              const sentMedia = await sendFacebookMessageMedia({
                media,
                ticket,
                body: Array.isArray(body) ? body[index] : body
              });

              if (ticket.channel === "facebook") {
                await verifyMessageMedia(
                  sentMedia,
                  ticket,
                  ticket.contact,
                  true
                );
              }
            } catch (error) {
              console.error(
                "Erro ao enviar mídia para Facebook/Instagram:",
                error
              );
            }
          }

          const filePath = path.resolve(
            "public",
            `company${companyId}`,
            media.filename
          );
          if (fs.existsSync(filePath) && isPrivate === "false") {
            fs.unlinkSync(filePath);
          }
        })
      );
    } else {
      if (ticket.channel === "whatsapp" && isPrivate === "false") {
        await SendWhatsAppMessage({ body, ticket, quotedMsg, vCard });
      } else if (ticket.channel === "whatsapp" && isPrivate === "true") {
        const messageData = {
          wid: `PVT${ticket.updatedAt.toString().replace(" ", "")}`,
          ticketId: ticket.id,
          contactId: undefined,
          body,
          fromMe: true,
          mediaType: !isNil(vCard)
            ? "contactMessage"
            : "extendedTextMessage",
          read: true,
          quotedMsgId: null,
          ack: 2,
          remoteJid: ticket.contact?.remoteJid,
          participant: null,
          dataJson: null,
          ticketTrakingId: null,
          isPrivate: isPrivate === "true",
          companyId: ticket.companyId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await CreateMessageService({
          messageData,
          companyId: ticket.companyId
        });
      } else if (["facebook", "instagram"].includes(ticket.channel)) {
        const sendText = await sendFaceMessage({
          body,
          ticket,
          quotedMsg
        });

        if (ticket.channel === "facebook") {
          await verifyMessageFace(
            sendText,
            body,
            ticket,
            ticket.contact,
            true
          );
        }
      }
    }
    return res
      .status(200)
      .json({ message: "Mensagem enviada com sucesso" });
  } catch (error: any) {
    console.error("Erro ao armazenar mensagem:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Encaminhar mensagem (CORRIGIDA para suportar localização)
// Encaminhar mensagem (CORRIGIDA para suportar localização e PIX interactive)
export const forwardMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { quotedMsg, signMessage, messageId, contactId } = req.body;
  const { id: userId, companyId } = req.user;
  const requestUser = await User.findByPk(userId);

  if (!messageId || !contactId) {
    return res
      .status(400)
      .json({ message: "MessageId or ContactId not found" });
  }

  const message = await ShowMessageService(messageId);
  const contact = await ShowContactService(contactId, companyId);

  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (!contact) {
    return res.status(404).json({ message: "Contact not found" });
  }

  const settings = await CompaniesSettings.findOne({ where: { companyId } });

  const whatsAppConnectionId = await GetWhatsAppFromMessage(message);
  if (!whatsAppConnectionId) {
    return res
      .status(404)
      .json({ message: "Whatsapp from message not found" });
  }

  const ticket = await ShowTicketService(
    message.ticketId,
    message.companyId
  );

  const mutex = new Mutex();

  const createTicket = await mutex.runExclusive(async () => {
    const result = await FindOrCreateTicketService(
      contact,
      ticket?.whatsapp,
      0,
      ticket.companyId,
      ticket.queueId,
      requestUser!.id,
      contact.isGroup ? contact : null,
      "whatsapp",
      null,
      true,
      settings,
      false,
      false
    );

    return result;
  });

  let ticketData;

  if (isNil(createTicket?.queueId)) {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser!.id,
      queueId: ticket.queueId
    };
  } else {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser!.id
    };
  }

  await UpdateTicketService({
    ticketData,
    ticketId: createTicket.id,
    companyId: createTicket.companyId
  });

  let body = message.body;

  // ✅✅ AQUI É O LOCAL CORRETO: tratar PIX/Interactive ANTES de localização e mídia
  // PIX chega como interactiveMessage/viewOnceMessage e NÃO é mídia para downloadMediaMessage.
  const safeBody = (body || "").toString();

  const isPixText =
    safeBody.includes("Pagamento (PIX)") ||
    safeBody.startsWith("[PIX]");

  const isInteractiveLike =
    message.mediaType === "interactiveMessage" ||
    message.mediaType === "viewOnceMessage" || // muitos interactives salvam assim no banco
    message.mediaType === "template" ||
    message.mediaType === "buttonsMessage" ||
    message.mediaType === "listMessage";

  // Se for PIX/interactive, encaminha como texto usando SendWhatsAppMessage (mantém compatibilidade do seu sistema)
  if (isPixText || isInteractiveLike) {
    await SendWhatsAppMessage({
      body: safeBody || "💳 Pagamento (PIX)",
      ticket: createTicket,
      quotedMsg,
      isForwarded: !message.fromMe
    });

    return res
      .status(200)
      .json({ message: "Mensagem encaminhada com sucesso (modo texto)" });
  }

  // TEXTO normal
  if (
    message.mediaType === "conversation" ||
    message.mediaType === "extendedTextMessage"
  ) {
    await SendWhatsAppMessage({
      body,
      ticket: createTicket,
      quotedMsg,
      isForwarded: !message.fromMe
    });

    return res
      .status(200)
      .json({ message: "Mensagem encaminhada com sucesso" });
  }

  // ====== LOCALIZAÇÃO ======
  if (message.mediaType === "locationMessage") {
    try {
      const locationData = extractLocationData(message);

      if (!locationData) {
        throw new AppError("Dados de localização não encontrados", 400);
      }

      const wbot = await GetTicketWbot(createTicket);
      const contact = createTicket.contact || await Contact.findByPk(createTicket.contactId);
      const jid = `${contact.number}@${createTicket.isGroup ? "g.us" : "s.whatsapp.net"}`;

      // Criar objeto de localização
      const locationToSend: any = {
        degreesLatitude: locationData.latitude,
        degreesLongitude: locationData.longitude
      };

      if (locationData.name) locationToSend.name = locationData.name;
      if (locationData.address) locationToSend.address = locationData.address;

      // Envia localização
      const sent = await (wbot as any).sendMessage(jid, {
        location: locationToSend
      });

      // Salva no banco
      const messageBody = `📍 ${locationData.name || 'Localização'}\nLat: ${locationData.latitude}\nLng: ${locationData.longitude}${locationData.address ? `\n${locationData.address}` : ''}`;

      const messageData = {
        wid: sent?.key?.id,
        ticketId: createTicket.id,
        body: messageBody,
        fromMe: true,
        mediaType: "locationMessage",
        read: true,
        ack: 1,
        remoteJid: jid,
        participant: createTicket.isGroup ? contact.number : "",
        dataJson: JSON.stringify({
          ...sent,
          locationData
        }),
        ticketTrakingId: createTicket.ticketTrakingId,
        companyId: createTicket.companyId,
        isPrivate: false,
        isEdited: false,
        isForwarded: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await CreateMessageService({ messageData, companyId: createTicket.companyId });

      return res.status(200).json({
        message: "Localização encaminhada com sucesso",
        data: locationData
      });

    } catch (error) {
      console.error("Erro ao encaminhar localização:", error);
      return res.status(400).json({
        message: "Erro ao encaminhar localização",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ====== MÍDIA ======
  let tempFilePath: string | null = null;

  try {
    if (message.dataJson) {
      const wbot = await GetTicketWbot(createTicket);

      const msgFound = JSON.parse(message.dataJson);

      const contentType = getContentType(msgFound.message);
      if (!contentType) {
        throw new Error("Tipo de conteúdo não identificado para download");
      }

      const buffer = await downloadMediaMessage(
        msgFound,
        "buffer",
        {},
        {
          logger: console as any,
          reuploadRequest: async (msg: any) => {
            return await (wbot as any).updateMediaMessage(msg);
          }
        }
      );

      let fileName = "arquivo";
      let mimetype = "application/octet-stream";

      if (contentType === "documentMessage") {
        const m = msgFound.message.documentMessage;
        fileName = m.fileName || "documento";
        mimetype = m.mimetype || "application/octet-stream";
      } else if (contentType === "imageMessage") {
        fileName = "imagem.jpg";
        mimetype = "image/jpeg";
      } else if (contentType === "videoMessage") {
        fileName = "video.mp4";
        mimetype = "video/mp4";
      } else if (contentType === "audioMessage") {
        fileName = "audio.ogg";
        mimetype = msgFound.message.audioMessage?.mimetype || "audio/ogg";
      }

      const publicFolder = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "backend",
        "public"
      );
      const companyFolder = path.join(publicFolder, `company${createTicket.companyId}`);

      if (!fs.existsSync(companyFolder)) {
        fs.mkdirSync(companyFolder, { recursive: true });
      }

      const safeName = fileName.replace(/[^\w.\-() ]/g, "_");
      const uniquePrefix = `fw_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const finalFileName = `${uniquePrefix}_${safeName}`;
      tempFilePath = path.join(companyFolder, finalFileName);

      fs.writeFileSync(tempFilePath, buffer);

      if (body === fileName || body === finalFileName) {
        body = "";
      }

      const mediaSrc = {
        fieldname: "medias",
        originalname: fileName,
        encoding: "7bit",
        mimetype,
        filename: finalFileName,
        path: tempFilePath
      } as Express.Multer.File;

      await SendWhatsAppMedia({
        media: mediaSrc,
        ticket: createTicket,
        body,
        isForwarded: !message.fromMe
      });

      try {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch { }

      return res
        .status(200)
        .json({ message: "Mensagem encaminhada com sucesso" });
    }
  } catch (err) {
    console.error("Falha ao baixar/re-enviar mídia no encaminhar:", err);

    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch { }
  }

  // ✅✅ CORREÇÃO DO NULL replace:
  const mediaUrlSafe = (message?.mediaUrl || "").toString();
  if (!mediaUrlSafe) {
    return res.status(400).json({
      message:
        "Não foi possível encaminhar: mensagem não é texto/localização e não possui mídia válida (mediaUrl/dataJson)."
    });
  }

  const mediaUrl = mediaUrlSafe.replace(`:${process.env.PORT}`, "");
  const fileName = obterNomeEExtensaoDoArquivo(mediaUrl);

  if (body === fileName) {
    body = "";
  }

  const publicFolder = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "backend",
    "public"
  );
  const filePath = path.join(
    publicFolder,
    `company${createTicket.companyId}`,
    fileName
  );

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({
      message:
        "Não foi possível encaminhar: arquivo não encontrado localmente e não foi possível baixar do WhatsApp."
    });
  }

  let fallbackMime = "application/octet-stream";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) fallbackMime = "application/pdf";
  else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) fallbackMime = "image/jpeg";
  else if (lower.endsWith(".png")) fallbackMime = "image/png";
  else if (lower.endsWith(".mp4")) fallbackMime = "video/mp4";
  else if (lower.endsWith(".mp3")) fallbackMime = "audio/mpeg";
  else if (lower.endsWith(".ogg")) fallbackMime = "audio/ogg";

  const mediaSrc = {
    fieldname: "medias",
    originalname: fileName,
    encoding: "7bit",
    mimetype: fallbackMime,
    filename: fileName,
    path: filePath
  } as Express.Multer.File;

  await SendWhatsAppMedia({
    media: mediaSrc,
    ticket: createTicket,
    body,
    isForwarded: !message.fromMe
  });

  return res
    .status(200)
    .json({ message: "Mensagem encaminhada com sucesso" });
};


// Remover mensagem
export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId, companyId);
  const io = getIO();

  if (message.isPrivate) {
    await Message.destroy({ where: { id: message.id } });
    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
      action: "delete",
      message
    });
  }

  io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  return res
    .status(200)
    .json({ message: "Mensagem removida com sucesso" });
};

// Contar mensagens
export const allMe = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dateStart: any = req.query.dateStart;
  const dateEnd: any = req.query.dateEnd;
  const fromMe: any = req.query.fromMe;
  const { companyId } = req.user;

  const { count } = await ListMessagesServiceAll({
    companyId,
    fromMe,
    dateStart,
    dateEnd
  });

  return res.json({ count });
};

// Enviar mensagem
export const send = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError("Token de autorização não fornecido", 401);
    }

    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });
    if (!whatsapp) {
      throw new AppError(
        "Não foi possível realizar a operação",
        404
      );
    }

    const companyId = whatsapp.companyId;
    const company = await ShowPlanCompanyService(companyId);
    const sendMessageWithExternalApi = company.plan.useExternalApi;

    if (!sendMessageWithExternalApi) {
      throw new AppError(
        "Essa empresa não tem permissão para usar a API Externa. Entre em contato com o Suporte para verificar nossos planos!",
        403
      );
    }

    if (messageData.number === undefined) {
      throw new AppError("O número é obrigatório", 400);
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    const CheckValidNumber = await CheckContactNumber(
      numberToTest,
      companyId
    );
    const number = (CheckValidNumber as any).replace
      ? (CheckValidNumber as any).replace(/\D/g, "")
      : String(CheckValidNumber).replace(/\D/g, "");

    console.log(
      `DEBUG - Número original: ${numberToTest}, Número formatado: ${number}`
    );

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId: whatsapp.id,
              data: {
                number,
                body: media.originalname.replace("/", "-"),
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId: whatsapp.id,
          data: {
            number,
            body
          }
        },
        { removeOnComplete: true, attempts: 3 }
      );
    }
    return res.status(200).json({ mensagem: "Mensagem enviada!" });
  } catch (err: any) {
    console.error("Erro ao enviar mensagem:", err);
    if (err instanceof AppError) {
      return res
        .status(err.statusCode)
        .json({ message: err.message });
    }
    throw new AppError(
      "Não foi possível enviar a mensagem, tente novamente em alguns instantes",
      500
    );
  }
};

// Editar mensagem
export const edit = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;
  const { body }: MessageData = req.body;

  try {
    const { ticket, message } = await EditWhatsAppMessage({
      messageId,
      body
    });

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
      action: "update",
      message
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

    return res
      .status(200)
      .json({ message: "Mensagem editada com sucesso" });
  } catch (error) {
    console.error("Erro ao editar mensagem:", error);
    throw new AppError("Erro ao editar mensagem", 500);
  }
};

// Enviar mensagem em fluxo
export const sendMessageFlow = async (
  whatsappId: number,
  body: any,
  req: Request,
  files?: Express.Multer.File[]
): Promise<string> => {
  const messageData = body;
  const medias = files;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError(
        "Não foi possível realizar a operação",
        404
      );
    }

    if (messageData.number === undefined) {
      throw new AppError("O número é obrigatório", 400);
    }

    const numberToTest = messageData.number;
    const msgBody = messageData.body;
    const companyId = messageData.companyId;

    const CheckValidNumber = await CheckContactNumber(
      numberToTest,
      companyId
    );
    const number = (CheckValidNumber as any).replace
      ? (CheckValidNumber as any).replace(/\D/g, "")
      : String(CheckValidNumber).replace(/\D/g, "");

    console.log(
      `DEBUG FLOW - Número original: ${numberToTest}, Número formatado: ${number}`
    );

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: media.originalname,
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId,
          data: {
            number,
            body: msgBody
          }
        },
        { removeOnComplete: false, attempts: 3 }
      );
    }

    return "Mensagem enviada";
  } catch (err: any) {
    console.error("Erro ao enviar mensagem no fluxo:", err);
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      "Não foi possível enviar a mensagem, tente novamente em alguns instantes",
      500
    );
  }
};