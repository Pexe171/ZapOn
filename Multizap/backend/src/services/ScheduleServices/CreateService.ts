import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import User from "../../models/User";
import { zonedTimeToUtc } from "date-fns-tz";

interface Request {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  ticketUserId?: number | string;
  queueId?: number | string;
  openTicket?: string;
  statusTicket?: string;
  whatsappId?: number | string;
  intervalo?: number;
  valorIntervalo?: number;
  enviarQuantasVezes?: number;
  tipoDias?: number;
  contadorEnvio?: number;
  assinar?: boolean;
}

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  ticketUserId,
  queueId,
  openTicket,
  statusTicket,
  whatsappId,
  intervalo,
  valorIntervalo,
  enviarQuantasVezes,
  tipoDias,
  assinar,
  contadorEnvio
}: Request): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.string().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // =========================
  // CONVERSÃO PARA UTC USANDO O FUSO DO USUÁRIO
  // =========================
  let sendAtUtc: Date;

  try {
    let userTimezone = "America/Sao_Paulo";

    if (userId) {
      const user = await User.findByPk(Number(userId));
      if (user?.timezone) {
        userTimezone = user.timezone;
      }
    }

    // sendAt vem como "data/hora local" do usuário
    sendAtUtc = zonedTimeToUtc(sendAt, userTimezone);
  } catch (error) {
    // fallback: tenta converter direto, caso venha ISO com timezone
    sendAtUtc = new Date(sendAt);
  }

  const schedule = await Schedule.create({
    body,
    sendAt: sendAtUtc,
    contactId,
    companyId,
    userId,
    status: "PENDENTE",
    ticketUserId,
    queueId,
    openTicket,
    statusTicket,
    whatsappId,
    intervalo,
    valorIntervalo,
    enviarQuantasVezes,
    tipoDias,
    assinar,
    contadorEnvio
  });

  await schedule.reload();

  return schedule;
};

export default CreateService;
