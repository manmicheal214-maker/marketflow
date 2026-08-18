/**
 * Email Service Abstraction
 * 
 * Provides a provider-agnostic interface for sending emails.
 * Currently uses a mock/demo provider. To add a real provider
 * (Mailpit, SendGrid, Postmark, AWS SES), implement the EmailProvider
 * interface and set it as the active provider.
 */

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

/**
 * Demo/Mock Email Provider
 * Logs emails to console instead of sending them.
 * Used when no SMTP credentials are configured.
 */
class DemoEmailProvider implements EmailProvider {
  name = "demo";

  async send(message: EmailMessage): Promise<EmailResult> {
    console.log(`[EmailService:Demo] Would send email to ${message.to}`);
    console.log(`  Subject: ${message.subject}`);
    return {
      success: true,
      messageId: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider: this.name,
    };
  }
}

/**
 * SMTP Email Provider (for Mailpit / production SMTP)
 * Uncomment and configure when SMTP credentials are available.
 * 
 * import nodemailer from "nodemailer";
 * 
 * class SmtpEmailProvider implements EmailProvider {
 *   name = "smtp";
 *   private transporter;
 * 
 *   constructor() {
 *     this.transporter = nodemailer.createTransport({
 *       host: process.env.SMTP_HOST || "localhost",
 *       port: parseInt(process.env.SMTP_PORT || "1025"),
 *       auth: process.env.SMTP_USER
 *         ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
 *         : undefined,
 *     });
 *   }
 * 
 *   async send(message: EmailMessage): Promise<EmailResult> {
 *     try {
 *       const info = await this.transporter.sendMail({
 *         from: message.from,
 *         to: message.to,
 *         subject: message.subject,
 *         html: message.html,
 *         text: message.text,
 *       });
 *       return { success: true, messageId: info.messageId, provider: this.name };
 *     } catch (error: any) {
 *       return { success: false, error: error.message, provider: this.name };
 *     }
 *   }
 * }
 */

// ── Active provider selection ──
function getActiveProvider(): EmailProvider {
  // Use SMTP if configured
  // if (process.env.SMTP_HOST) {
  //   return new SmtpEmailProvider();
  // }
  return new DemoEmailProvider();
}

const provider = getActiveProvider();

/**
 * Send an email using the active provider.
 * This is the main entry point — components should call this,
 * never access the provider directly.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  return provider.send(message);
}

export function getEmailProviderName(): string {
  return provider.name;
}

export function isDemoMode(): boolean {
  return provider.name === "demo";
}
