import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

export interface ParentInvitationEmailPayload {
  to: string;
  parentFullName: string;
  patientName: string;
  inviteUrl: string;
}

@Injectable()
export class ParentEmailService {
  private get resendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    return new Resend(apiKey);
  }

  private get fromEmail(): string {
    const fromEmail = process.env.PARENT_INVITE_FROM_EMAIL;

    if (!fromEmail) {
      throw new Error('PARENT_INVITE_FROM_EMAIL is not configured');
    }

    return fromEmail;
  }

  async sendParentInvitationEmail(payload: ParentInvitationEmailPayload) {
    const response = (await this.resendClient.emails.send({
      from: this.fromEmail,
      to: payload.to,
      subject: `Tri-Heal invitation to access ${payload.patientName}`,
      html: `<p>Hi ${payload.parentFullName},</p>
        <p>You have been invited to access the Tri-Heal app for ${payload.patientName}.</p>
        <p><a href="${payload.inviteUrl}">Activate your parent access</a></p>
        <p>This link expires in 24 hours.</p>`,
    })) as unknown as {
      id?: string;
      message?: string;
    };

    if (!response.id) {
      throw new Error(response.message ?? 'Failed to send parent invitation');
    }

    return response;
  }
}
