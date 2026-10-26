import 'server-only';
import nodemailer from 'nodemailer';
import { serverEnv } from '@/lib/env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Sends mail over SMTP. Locally this is Supabase's mail catcher (http://127.0.0.1:54324). */
export async function sendMail(mail: Mail): Promise<void> {
  const env = serverEnv();
  if (!env.SMTP_HOST) {
    console.info(`[mail disabled] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: env.SMTP_FROM, ...mail });
}
