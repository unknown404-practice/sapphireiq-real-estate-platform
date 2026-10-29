import nodemailer from 'nodemailer';
import { env } from '../config/env';

interface SendPasswordResetParams {
  to: string;
  resetUrl: string;
  name: string;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  name,
}: SendPasswordResetParams): Promise<{ delivered: boolean; info?: string }> {
  // Check if SMTP is configured
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn(
      `[EmailService] SMTP not configured. Password reset link for ${to}: ${resetUrl}`
    );
    return {
      delivered: false,
      info: 'SMTP credentials not configured. Reset link generated and logged to server console.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"SapphireIQ Support" <${env.EMAIL_FROM}>`,
      to,
      subject: 'Password Reset Request - SapphireIQ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0170c7;">SapphireIQ Real Estate</h2>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #0170c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 60 minutes. If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">SapphireIQ Real Estate Platform &copy; ${new Date().getFullYear()}</p>
        </div>
      `,
    });

    return { delivered: true, info: info.messageId };
  } catch (err: any) {
    console.error(`[EmailService] Failed to send password reset email to ${to}:`, err.message);
    return { delivered: false, info: err.message };
  }
}
