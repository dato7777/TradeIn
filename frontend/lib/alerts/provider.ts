import { Resend } from "resend";
import type { EmailProvider, OutboundEmail } from "@/lib/alerts/types";

export class EmailHeaderError extends Error {
  constructor() {
    super("header");
    this.name = "EmailHeaderError";
  }
}

function clean(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new EmailHeaderError();
  return value;
}

export function assertOutbound(message: OutboundEmail): void {
  clean(message.to);
  clean(message.from);
  clean(message.replyTo);
  clean(message.subject);
  if (message.headers) {
    for (const [key, value] of Object.entries(message.headers)) {
      clean(key);
      clean(value);
    }
  }
}

const memoryMessages: OutboundEmail[] = [];

export function memoryOutbox(): readonly OutboundEmail[] {
  return memoryMessages;
}

export function clearMemoryOutbox(): void {
  memoryMessages.length = 0;
}

export function memoryProvider(): EmailProvider {
  return {
    async send(message) {
      assertOutbound(message);
      memoryMessages.push(message);
      return { id: `memory-${memoryMessages.length}` };
    },
  };
}

export function consoleProvider(): EmailProvider {
  return {
    async send(message) {
      assertOutbound(message);
      console.info("price-alert console send", { subject: message.subject });
      return { id: "console" };
    },
  };
}

export function resendProvider(apiKey: string): EmailProvider {
  const resend = new Resend(apiKey);
  return {
    async send(message) {
      assertOutbound(message);
      const result = await resend.emails.send(
        {
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo,
          headers: message.headers,
        },
        message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
      );
      if (result.error || !result.data?.id) throw new EmailHeaderError();
      return { id: result.data.id };
    },
  };
}

export function fromHeader(siteName: string, emailFrom: string): string {
  const address = (emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom).trim();
  const name = siteName.replace(/["\\\r\n]/g, "").trim();
  return clean(`"${name}" <${clean(address)}>`);
}

export function providerMessageId(id: string): string | null {
  const cleanId = id.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
  return cleanId || null;
}
