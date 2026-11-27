import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Thin wrapper over nodemailer's SMTP transport. Locally it points to Mailpit,
 * which catches every email; in production, to any SMTP provider.
 * It throws on failure so the queue can retry the job.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = nodemailer.createTransport(
      config.get('SMTP_URL', { infer: true }),
    );
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(message: MailMessage): Promise<void> {
    if (isUndeliverable(message.to)) {
      this.logger.log(`Skipped "${message.subject}" to ${message.to}`);
      return;
    }
    const info = await this.transporter.sendMail({
      from: this.from,
      ...message,
    });
    this.logger.log(
      `Sent "${message.subject}" to ${message.to} (${info.messageId})`,
    );
  }

  onModuleDestroy() {
    this.transporter.close();
  }
}

/**
 * Addresses under the reserved `.invalid` TLD (RFC 2606) can never receive
 * email, so they are never sent to: the demo's seeded customers use it, and a
 * real SMTP provider would count every attempt as a bounce.
 */
export function isUndeliverable(address: string): boolean {
  return /\.invalid$/i.test(address.trim());
}
