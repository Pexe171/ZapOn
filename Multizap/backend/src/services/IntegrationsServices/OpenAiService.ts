import { MessageUpsertType, proto, WASocket } from "baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  transferQueue,
  verifyMediaMessage,
  verifyMessage,
} from "../WbotServices/wbotMessageListener";
import { isNil, isNull } from "lodash";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";

// mantém letras (com acento), números, pontuação comum e quebras de linha
const keepOnlySpecifiedChars = (text: string): string => {
  if (!text) return "";
  // remove caracteres de controle estranhos, preservando PT-BR
  return text
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n\r\t]/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  model: string;
  openAiApiKey?: string;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
  apiKeyValue?: string;
}

interface SessionGemini extends GoogleGenerativeAI {
  id?: number;
  apiKeyValue?: string;
}

const sessionsOpenAi: SessionOpenAi[] = [];
const sessionsGemini: SessionGemini[] = [];

// ===== util =====
const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

// sanitiza a API key que vem do fluxo
const cleanApiKey = (k: string) =>
  (k || "")
    .replace(/^["']|["']$/g, "") // tira aspas no início/fim
    .replace(/\s+/g, "") // remove espaços/quebras internas
    .trim();

// mensagens de erro mais claras
function humanizeAIError(provider: "openai" | "gemini", err: any): string {
  const status =
    err?.status ||
    err?.response?.status ||
    err?.response?.data?.error?.status ||
    err?.code;

  const prov = provider.toUpperCase();

  if (status === 401) return `${prov}: 401 (API key inválida). Verifique a chave do fluxo.`;
  if (status === 403) return `${prov}: 403 (acesso bloqueado/billing/quotas).`;
  if (status === 429) return `${prov}: 429 (limite/velocidade atingido). Tente novamente.`;
  if (status && Number(status) >= 500)
    return `${prov}: ${status} (instabilidade do provedor).`;
  if (err?.name === "AbortError") return `${prov}: tempo limite esgotado.`;
  return `${prov}: falha ao processar — ${err?.message || "erro desconhecido"}`;
}

// anti-loop de transferência e de mensagem "aguarde"
const NOTIFY_COOLDOWN_MS = 60_000; // 1 min
const lastNotifyAt = new Map<number, number>(); // ticketId -> timestamp

// 🔹 tickets onde a IA deve ficar desativada (apenas para aquele chamado)
const disabledAIBotTickets = new Set<number>(); // ticketId

// 🔹 palavras-chave de intenção clara de falar com humano
const HUMAN_KEYWORDS = [
  // PORTUGUÊS
  "atendimento humano",
  "suporte",
  "falar com o suporte",
  "falar com atendimento",
  "falar com o atendimento",
  "falar com atendente",
  "falar com o atendente",
  "quero falar com uma pessoa",
  "quero falar com pessoa",
  "falar com humano",
  "falar com uma pessoa",
  "falar com um humano",
  "atendente humano",
  "quero um atendente",
  "me transfira para o etendimento", // mantido erro de grafia caso usuario digite errado
  "me transfere para o etendimento",
  "me transfira para o atendimento",
  "me transfere para o atendimento",
  "quero atendimento humano",
  "falar com suporte",
  "falar com o suporte",
  "transfere para um humano",
  "bot não resolve",
  "robô não resolve",
  "atendimento automático não resolve",
  "preciso de ajuda real",
  "ajuda de verdade",
  "atendimento de verdade",
  "suporte de verdade",
  "suporte humano",
  "assistência humana",
  "contato humano",
  "atender pessoalmente",
  "contato real",
  "pessoa de verdade",
  "operador humano",
  "agente humano",
  "colaborador humano",
  "atendente de verdade",
   "sair do bot",
  "sair do atendimento automático",
  "sair do robô",
  "não quero mais bot",
  "chega de bot",
  
  // INGLÊS (English)
  "human agent",
  "talk to human",
  "talk to a human",
  "speak to human",
  "speak with human",
  "customer service",
  "support",
  "contact support",
  "talk to agent",
  "speak to agent",
  "human support",
  "representative",
  "i want to speak to a person",
  "human support",
  "speak with human",
  "speak to a person",
  "talk to human",
  "talk to a person",
  "human agent",
  "live agent",
  "real person",
  "customer service",
  "customer support",
  "support agent",
  "service representative",
  "human representative",
  "transfer to agent",
  "connect to agent",
  "speak with representative",
  "talk to representative",
  "human assistance",
  "live assistance",
  "real human",
  "actual person",
  "human operator",
  "operator assistance",
  "agent assistance",
  "get a human",
  "need a human",
  "want a human",
  "human please",
  "stop bot",
  "stop the bot",
  "end bot",
  "exit bot",
  "leave bot",
  "bot can't help",
  "bot not helping",
  "robot can't help",
  "automated system can't help",
  "urgent help",
  "emergency",
  "urgent matter",
  "critical issue",
  "serious problem",
  "complaint",
  "file complaint",
  "make complaint",
  "not resolved",
  "not solved",
  "issue not fixed",
  "problem not solved",
  "need real help",
  "need actual help",
  "genuine support",

  // ESPANHOL (Español)
  "atención humana",
  "hablar con humano",
  "hablar con un humano",
  "atención al cliente",
  "agente",
  "soporte",
  "hablar con persona",
  "hablar con una persona",
  "quiero hablar con alguien",
  "necesito soporte",
  "asistencia humana",
  "agente humano",
  "persona real",
  "atención personal",
  "soporte humano",
  "asistencia humana",
  "contacto humano",
  "operador humano",
  "representante humano",
  "transferir a agente",
  "conectar con agente",
  "hablar con representante",
  "necesito un humano",
  "quiero un humano",
  "humano por favor",
  "detener bot",
  "parar bot",
  "salir del bot",
  "dejar el bot",
  "bot no ayuda",
  "robot no ayuda",
  "sistema automatizado no ayuda",
  "ayuda urgente",
  "emergencia",
  "asunto urgente",
  "problema crítico",
  "problema serio",
  "queja",
  "presentar queja",
  "no resuelto",
  "no solucionado",
  "problema no resuelto",
  "necesito ayuda real",
  "ayuda genuina",
  "soporte real",
  "atención real",
  "persona de verdad",
  "Hable con el servicio de atención al cliente",
  "atendedor humano",
  "colaborador humano",
  "asistente humano",
  "consultor humano",
  "especialista humano",
  "técnico humano",
  "soporte técnico humano",
];

// ===== helpers =====
const prepareMessagesAI = (
  pastMessages: Message[],
  isGeminiModel: boolean,
  promptSystem: string
): any[] => {
  const messagesAI: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (!isGeminiModel) {
    messagesAI.push({ role: "system", content: promptSystem });
  }

  for (const message of pastMessages) {
    if (
      message.mediaType === "conversation" ||
      message.mediaType === "extendedTextMessage"
    ) {
      if (message.fromMe) {
        messagesAI.push({ role: "assistant", content: message.body });
      } else {
        messagesAI.push({ role: "user", content: message.body });
      }
    }
  }

  return messagesAI;
};

// ===== processamento da resposta =====
const processResponse = async (
  responseText: string,
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  openAiSettings: IOpenAi,
  ticketTraking: TicketTraking,
  userText: string | null
): Promise<void> => {
  let response = responseText || "";

  // normaliza input do cliente para checar se ele REALMENTE pediu humano
  const userNorm = (userText || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const clientExplicitlyWantsHuman = HUMAN_KEYWORDS.some(k =>
    userNorm.includes(
      k
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    )
  );

  // ===== DETECÇÃO ROBUSTA DA AÇÃO DE TRANSFERÊNCIA =====
  const normalized = response
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const transferTag = "acao: transferir para o setor de atendimento";

  // Só transfere se:
  // 1) a resposta COMEÇAR com a tag
  // 2) o texto do cliente indicar CLARAMENTE que quer atendimento humano
  const shouldTransfer =
    normalized.startsWith(transferTag) && clientExplicitlyWantsHuman;

  // disparo de transferência (idempotente e com cooldown)
  if (shouldTransfer) {
    // 1) define de onde vem o queueId:
    //    - prioridade 1: queueId configurado no nó OpenAI do FlowBuilder
    //    - prioridade 2: queueId atual do ticket (se já estiver numa fila)
    const raw = (openAiSettings as any)?.queueId;
    const n = Number(raw);
    let targetQueueId: number | null =
      Number.isFinite(n) && n > 0
        ? n
        : ticket.queueId && Number(ticket.queueId) > 0
          ? Number(ticket.queueId)
          : null;

    const now = Date.now();
    const last = lastNotifyAt.get(ticket.id) || 0;

    try {
      // só tenta transferir se mudou o destino ou passou o cooldown
      if (ticket?.queueId !== targetQueueId || now - last > NOTIFY_COOLDOWN_MS) {
        await transferQueue(targetQueueId, ticket, contact);

        // 🔹 marca apenas ESTE ticket para não chamar mais a IA
        disabledAIBotTickets.add(ticket.id);

        lastNotifyAt.set(ticket.id, now);
      }

      // avisa "aguarde" no máx. 1x por minuto (mensagem opcional pro cliente)
      const lastNotify = lastNotifyAt.get(ticket.id) || 0;
      if (Date.now() - lastNotify >= NOTIFY_COOLDOWN_MS) {
        const sent = await wbot.sendMessage(msg.key.remoteJid!, {
          text:
            "Por favor, aguarde, em breve um de nossos colaboradores irá lhe atender. " +
            "Para retornar ao bot, envie # a qualquer momento."
        });
        try {
          await verifyMessage(sent!, ticket, contact);
        } catch (_) { }
        lastNotifyAt.set(ticket.id, Date.now());
      }
    } catch (e: any) {
      console.error("transferQueue falhou", {
        targetQueueId,
        ticketId: ticket.id,
        err: e?.message || e
      });
    }

    // remove o texto de ação da resposta antes de enviar qualquer complemento
    response = response
      .replace(/ação: transferir para o setor de atendimento/i, "")
      .trim();

    // se depois de remover a ação não sobrou nada, não tem porque mandar mais mensagem de bot
    if (!response) {
      return;
    }
  } else {
    // Se o modelo colocou a tag mas o cliente NÃO pediu humano,
    // limpamos a tag e seguimos só com a resposta normal
    response = response
      .replace(/ação: transferir para o setor de atendimento/i, "")
      .trim();
  }

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );


  // "digitando..."
  await wbot.sendPresenceUpdate("composing", msg.key.remoteJid!);
  await new Promise(resolve => setTimeout(resolve, 3000));
  await wbot.sendPresenceUpdate("paused", msg.key.remoteJid!);

  // envia como texto ou áudio
  if (openAiSettings.voice === "texto") {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response}`
    });
    try {
      await verifyMessage(sentMessage!, ticket, contact);
    } catch (e: any) {
      if ((e?.message || e) !== "ERR_UPDATE_TICKET")
        console.warn("verifyMessage falhou:", e?.message || e);
    }
  } else {
    const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
    try {
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response),
        `${publicFolder}/${fileNameWithOutExtension}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      );
      const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
        mimetype: "audio/mpeg",
        ptt: true
      });
      try {
        await verifyMediaMessage(
          sendMessage!,
          ticket,
          contact,
          ticketTraking,
          false,
          false,
          wbot
        );
      } catch (e: any) {
        if ((e?.message || e) !== "ERR_UPDATE_TICKET")
          console.warn("verifyMediaMessage falhou:", e?.message || e);
      }
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
    } catch (error) {
      console.error(`Erro para responder com audio: ${error}`);
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response}`
      });
      try {
        await verifyMessage(sentMessage!, ticket, contact);
      } catch (e: any) {
        if ((e?.message || e) !== "ERR_UPDATE_TICKET")
          console.warn("verifyMessage falhou:", e?.message || e);
      }
    }
  }
};

// ===== chamadas aos provedores =====
const handleOpenAIRequest = async (
  openai: SessionOpenAi,
  messagesAI: any[],
  openAiSettings: IOpenAi
): Promise<string> => {
  try {
    const chat = await openai.chat.completions.create({
      model: openAiSettings.model,
      messages: messagesAI,
      max_tokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature
    });
    return chat.choices[0].message?.content || "";
  } catch (error) {
    console.error("OpenAI request error:", error);
    throw error;
  }
};

const handleGeminiRequest = async (
  gemini: SessionGemini,
  messagesAI: any[],
  openAiSettings: IOpenAi,
  bodyMessage: string,
  promptSystem: string
): Promise<string> => {
  try {
    const model = gemini.getGenerativeModel({
      model: openAiSettings.model,
      systemInstruction: promptSystem
        ? { role: "system", parts: [{ text: promptSystem }] }
        : undefined
    });

    const geminiHistory: { role: "user" | "model"; parts: Part[] }[] =
      messagesAI.map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: String(msg.content ?? "") }]
      }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(bodyMessage);
    return result.response.text();
  } catch (error) {
    console.error("Gemini request error:", error);
    throw error;
  }
};

// ===== orquestração =====
export const handleOpenAi = async (
  openAiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking
): Promise<void> => {
  const bodyMessage = getBodyMessage(msg);

  // 🔹 permite reativar o BOT enviando "#"
  if (disabledAIBotTickets.has(ticket.id)) {
    if (bodyMessage && bodyMessage.trim() === "#") {
      disabledAIBotTickets.delete(ticket.id);
      // mensagem opcional avisando que voltou para o bot
      const sent = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Bot reativado. Como posso ajudar você novamente?"
      });
      try {
        await verifyMessage(sent!, ticket, contact);
      } catch (_) { }
    } else {
      // se não mandou "#", não responde mais enquanto estiver em atendimento humano
      return;
    }
  }

  if (!bodyMessage && !msg.message?.audioMessage) return;
  if (!openAiSettings) return;
  if (msg.messageStubType) return;

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );


  // ===== detecção do provedor (OpenAI vs Gemini) =====
  const modelName = (openAiSettings.model || "").toLowerCase().trim();
  const cleanedKey = cleanApiKey(openAiSettings.apiKey);

  const keyLooksGemini = /^AIza/i.test(cleanedKey);
  const keyLooksOpenAI = /^sk-/i.test(cleanedKey);

  let isGeminiModel = modelName.includes("gemini");
  let isOpenAIModel = modelName.startsWith("gpt-");

  // Prioriza o formato da chave sobre o nome do modelo
  if (keyLooksGemini) {
    isGeminiModel = true;
    isOpenAIModel = false;
  } else if (keyLooksOpenAI) {
    isOpenAIModel = true;
    isGeminiModel = false;
  }

  let openai: SessionOpenAi | null = null;
  let gemini: SessionGemini | null = null;

  if (isOpenAIModel) {
    const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
    if (
      openAiIndex === -1 ||
      sessionsOpenAi[openAiIndex].apiKeyValue !== cleanedKey
    ) {
      openai = new OpenAI({ apiKey: cleanedKey }) as SessionOpenAi;
      openai.id = ticket.id;
      openai.apiKeyValue = cleanedKey;
      if (openAiIndex === -1) {
        sessionsOpenAi.push(openai);
      } else {
        sessionsOpenAi[openAiIndex] = openai;
      }
    } else {
      openai = sessionsOpenAi[openAiIndex];
    }
  } else if (isGeminiModel) {
    const geminiIndex = sessionsGemini.findIndex(s => s.id === ticket.id);
    if (
      geminiIndex === -1 ||
      sessionsGemini[geminiIndex].apiKeyValue !== cleanedKey
    ) {
      gemini = new GoogleGenerativeAI(cleanedKey) as SessionGemini;
      gemini.id = ticket.id;
      gemini.apiKeyValue = cleanedKey;
      if (geminiIndex === -1) {
        sessionsGemini.push(gemini);
      } else {
        sessionsGemini[geminiIndex] = gemini;
      }
    } else {
      gemini = sessionsGemini[geminiIndex];
    }
  } else {
    console.error(
      `Unsupported model or API key: model=${openAiSettings.model}, key=${cleanedKey.slice(
        0,
        5
      )}***`
    );
    return;
  }

  // OpenAI para transcrição (se tiver chave específica)
  if (isOpenAIModel && openAiSettings.openAiApiKey && !openai) {
    const cleanedTranscriptionKey = cleanApiKey(
      openAiSettings.openAiApiKey || openAiSettings.apiKey
    );
    const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
    if (
      openAiIndex === -1 ||
      sessionsOpenAi[openAiIndex].apiKeyValue !== cleanedTranscriptionKey
    ) {
      openai = new OpenAI({ apiKey: cleanedTranscriptionKey }) as SessionOpenAi;
      openai.id = ticket.id;
      openai.apiKeyValue = cleanedTranscriptionKey;
      if (openAiIndex === -1) {
        sessionsOpenAi.push(openai);
      } else {
        sessionsOpenAi[openAiIndex] = openai;
      }
    } else {
      openai = sessionsOpenAi[openAiIndex];
    }
  }

  // histórico
  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "ASC"]],
    limit: openAiSettings.maxMessages
  });

  // prompt de sistema
  const clientName = sanitizeName(contact.name || "Amigo(a)");
  const promptSystem = `Instruções do Sistema:
  - Use o nome ${clientName} nas respostas para que o cliente se sinta mais próximo e acolhido.
  - Certifique-se de que a resposta tenha até ${openAiSettings.maxTokens} tokens e termine de forma completa, sem cortes.
  - Sempre que possível, inclua o nome do cliente para tornar o atendimento mais pessoal e gentil. Se não souber o nome pergunte.
  - Considere que o cliente quer falar com um atendente humano apenas quando usar frases como, por exemplo:
    • "atendimento humano", "falar com atendente", "quero um humano"
    • "human agent", "talk to support", "customer service"
    • "hablar con agente", "atención humana", "soporte"
    • "falar com o atendimento", "quero falar com uma pessoa", "transfere agora"
  - SOMENTE nesses casos (seja em português, inglês ou espanhol), e nunca por insegurança na resposta, inicie a sua resposta com exatamente:
    "Ação: Transferir para o setor de atendimento"
    na PRIMEIRA linha da resposta, e em seguida escreva uma mensagem curta avisando que vai transferir para um atendente humano.
  - Não use essa frase se o cliente apenas digitou um número de menu (por exemplo, "1", "2", "3").
  - Ignore completamente nomes de filas internas como "Atendimento", "Suporte", "Humano", "Financeiro", "Comercial", "Operacional", "Help Desk", "Fila", "Setor", "Agente" ou similares. Esses nomes não representam o pedido do cliente e não devem influenciar sua resposta.
  - Nunca invente processos ou promessas que o sistema não possa cumprir.

  Prompt Específico:
  ${openAiSettings.prompt}

  Siga essas instruções com cuidado para garantir um atendimento claro e amigável em todas as respostas.`;

  // texto
  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

    try {
      let responseText: string | null = null;

      if (isOpenAIModel && openai) {
        messagesAI.push({ role: "user", content: bodyMessage! });
        responseText = await handleOpenAIRequest(openai, messagesAI, openAiSettings);
      } else if (isGeminiModel && gemini) {
        responseText = await handleGeminiRequest(
          gemini,
          messagesAI,
          openAiSettings,
          bodyMessage!,
          promptSystem
        );
      }

      if (!responseText) {
        console.error("No response from AI provider");
        return;
      }

      await processResponse(
        responseText,
        wbot,
        msg,
        ticket,
        contact,
        openAiSettings,
        ticketTraking,
        bodyMessage || ""
      );
    } catch (error: any) {
      const isTicketErr =
        (error?.message || error) === "ERR_UPDATE_TICKET" ||
        error?.body === "ERR_UPDATE_TICKET" ||
        error?.errMsg === "ERR_UPDATE_TICKET_QUEUE_NOT_FOUND";

      if (isTicketErr) {
        console.error(
          "Ticket update falhou durante resposta da IA (não é erro da IA)."
        );
        return;
      }

      console.error("AI request failed:", {
        provider: isGeminiModel ? "gemini" : "openai",
        status: error?.status || error?.response?.status,
        body: error?.body || error?.response?.data || error?.message
      });

      const userMsg = humanizeAIError(
        isGeminiModel ? "gemini" : "openai",
        error
      );
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: userMsg
      });
      try {
        await verifyMessage(sentMessage!, ticket, contact);
      } catch (_) { }
    }
  }
  // áudio
  else if (msg.message?.audioMessage && mediaSent) {
    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

    try {
      const mediaUrl = mediaSent.mediaUrl!.split("/").pop();
      const audioFilePath = `${publicFolder}/${mediaUrl}`;

      if (!fs.existsSync(audioFilePath)) {
        console.error(`Arquivo de áudio não encontrado: ${audioFilePath}`);
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text:
            "Desculpe, não foi possível processar seu áudio. Por favor, tente novamente."
        });
        try {
          await verifyMessage(sentMessage!, ticket, contact);
        } catch (_) { }
        return;
      }

      let transcription: string | null = null;

      if (isOpenAIModel && openai) {
        const file = fs.createReadStream(audioFilePath) as any;
        const transcriptionResult = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: file
        });
        transcription = transcriptionResult.text;

        const sentTranscriptMessage = await wbot.sendMessage(
          msg.key.remoteJid!,
          {
            text: `🎤 *Sua mensagem de voz:* ${transcription}`
          }
        );
        try {
          await verifyMessage(sentTranscriptMessage!, ticket, contact);
        } catch (_) { }

        messagesAI.push({ role: "user", content: transcription });
        const responseText = await handleOpenAIRequest(
          openai,
          messagesAI,
          openAiSettings
        );
        if (responseText) {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            openAiSettings,
            ticketTraking,
            transcription || ""
          );
        }
      } else if (isGeminiModel && gemini) {
  // ✅ 1) Modelo APENAS para transcrição (sem systemInstruction)
  // Isso evita o Gemini "inventar" texto no estilo do bot/prompt.
  const transcriber = gemini.getGenerativeModel({
    model: openAiSettings.model
    // ⚠️ sem systemInstruction aqui
  });

  const audioFileBase64 = fs.readFileSync(audioFilePath, {
    encoding: "base64"
  });
  const fileExtension = path.extname(audioFilePath).toLowerCase();

  let mimeType = "audio/mpeg";
  switch (fileExtension) {
    case ".wav":
      mimeType = "audio/wav";
      break;
    case ".mp3":
      mimeType = "audio/mpeg";
      break;
    case ".aac":
      mimeType = "audio/aac";
      break;
    case ".ogg":
      mimeType = "audio/ogg";
      break;
    case ".flac":
      mimeType = "audio/flac";
      break;
    case ".aiff":
      mimeType = "audio/aiff";
      break;
  }

  const transcriptionRequest = await transcriber.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Transcreva exatamente o áudio em pt-BR. " +
              "Não responda, não explique, não resuma e não invente. " +
              "Retorne SOMENTE a transcrição literal."
          },
          { inlineData: { mimeType, data: audioFileBase64 } }
        ]
      }
    ]
  });

  transcription = transcriptionRequest.response.text();
  transcription = keepOnlySpecifiedChars(transcription || "");

  // ✅ 2) Envia a transcrição no ticket atual (usando JID normalizado)
  const to = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

  const sentTranscriptMessage = await wbot.sendMessage(to, {
    text: `🎤 *Sua mensagem de voz:* ${transcription}`
  });

  try {
    await verifyMessage(sentTranscriptMessage!, ticket, contact);
  } catch (_) {}

  // ✅ 3) Agora sim, usa a transcrição como "entrada do usuário" para o chat com promptSystem
  // (o prompt do bot só entra aqui, na resposta — não na transcrição)
  const responseText = await handleGeminiRequest(
    gemini,
    messagesAI,
    openAiSettings,
    transcription,
    promptSystem
  );

  if (responseText) {
    await processResponse(
      responseText,
      wbot,
      msg,
      ticket,
      contact,
      openAiSettings,
      ticketTraking,
      transcription || ""
    );
  }
}

      if (!transcription) {
        console.warn("Transcrição vazia recebida");
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text:
            "Desculpe, não consegui entender o áudio. Por favor, tente novamente ou envie uma mensagem de texto."
        });
        try {
          await verifyMessage(sentMessage!, ticket, contact);
        } catch (_) { }
      }
    } catch (error: any) {
      console.error("Erro no processamento de áudio:", error);
      const errorMessage =
        error?.response?.error?.message || error.message || "Erro desconhecido";
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `Desculpe, houve um erro ao processar sua mensagem de áudio: ${errorMessage}`
      });
      try {
        await verifyMessage(sentMessage!, ticket, contact);
      } catch (_) { }
    }
  }
};