import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

export const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();
  const pass = rawPass.replace(/\s+/g, ''); // strip spaces from Google app passwords

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return transporter;
};

/**
 * Send an email message
 * @param {Object} options - { to, subject, html, text, cc, bcc }
 * @returns {Promise<Object>}
 */
export const sendEmail = async ({ to, subject, html, text, cc, bcc }) => {
  const mailTransporter = getTransporter();
  const from = process.env.EMAIL_FROM || `"Petsfolio Performance" <${process.env.SMTP_USER || 'noreply@petsfolio.com'}>`;

  if (!mailTransporter) {
    console.warn(`[EmailService] SMTP credentials not configured. Simulated sending email to: ${to} | Subject: "${subject}"`);
    return {
      success: true,
      simulated: true,
      message: 'SMTP credentials not configured. Email logged in console (Simulated).',
      to,
      subject,
    };
  }

  try {
    const info = await mailTransporter.sendMail({
      from,
      to,
      cc,
      bcc,
      subject,
      text: text || '',
      html: html || '',
    });

    console.log(`[EmailService] Email successfully sent to ${to}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      to,
    };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
    return {
      success: false,
      error: error.message,
      to,
    };
  }
};

export default {
  getTransporter,
  sendEmail,
};
