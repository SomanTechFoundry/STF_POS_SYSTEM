import nodemailer from "nodemailer";
import env from "../config/env.js";
import { ApiError } from "./ApiError.js";

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!env.SMTP_HOST) {
    throw new ApiError(500, "SMTP email transport is not configured");
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS
        }
      : undefined
  });

  return transporter;
}

async function sendViaBrevoApi({ fromEmail, requester, approveUrl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(env.BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          email: fromEmail,
          name: "POS Platform"
        },
        to: [{ email: env.APPROVAL_TO_EMAIL }],
        subject: `Approval required: ${requester.businessName}`,
        textContent: `New signup request\nBusiness: ${requester.businessName}\nName: ${requester.fullName}\nEmail: ${requester.email}\nApprove: ${approveUrl}`,
        htmlContent: `
          <h2>New POS Signup Request</h2>
          <p><strong>Business:</strong> ${requester.businessName}</p>
          <p><strong>Name:</strong> ${requester.fullName}</p>
          <p><strong>Email:</strong> ${requester.email}</p>
          <p>
            <a href="${approveUrl}" style="display:inline-block;padding:10px 14px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;">
              Approve Signup
            </a>
          </p>
          <p>If the button does not work, use this link: ${approveUrl}</p>
        `
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const reason = payload?.message || payload?.code || `HTTP ${response.status}`;
      throw new ApiError(502, `Brevo API send failed: ${reason}`);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(502, "Brevo API timed out while sending email.");
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(502, `Brevo API send failed: ${error?.message || "Unknown error"}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendSignupApprovalEmail({ requester, approveUrl }) {
  if (!env.APPROVAL_TO_EMAIL) {
    throw new ApiError(500, "APPROVAL_TO_EMAIL is not configured");
  }

  const fromEmail = env.SMTP_FROM_EMAIL || env.SMTP_USER || env.APPROVAL_TO_EMAIL;
  if (env.BREVO_API_KEY) {
    await sendViaBrevoApi({ fromEmail, requester, approveUrl });
    return;
  }

  try {
    await getTransporter().sendMail({
      from: fromEmail,
      to: env.APPROVAL_TO_EMAIL,
      subject: `Approval required: ${requester.businessName}`,
      text: `New signup request\nBusiness: ${requester.businessName}\nName: ${requester.fullName}\nEmail: ${requester.email}\nApprove: ${approveUrl}`,
      html: `
        <h2>New POS Signup Request</h2>
        <p><strong>Business:</strong> ${requester.businessName}</p>
        <p><strong>Name:</strong> ${requester.fullName}</p>
        <p><strong>Email:</strong> ${requester.email}</p>
        <p>
          <a href="${approveUrl}" style="display:inline-block;padding:10px 14px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;">
            Approve Signup
          </a>
        </p>
        <p>If the button does not work, use this link: ${approveUrl}</p>
      `
    });
  } catch (error) {
    const code = String(error?.code || "").toUpperCase();
    if (code.includes("ETIMEDOUT") || code.includes("ECONNECTION")) {
      throw new ApiError(502, "SMTP connection timed out. Verify SMTP host/port/security and provider allowlist.");
    }
    if (code.includes("EAUTH")) {
      throw new ApiError(502, "SMTP authentication failed. Verify SMTP_USER and SMTP_PASS.");
    }
    throw new ApiError(502, `SMTP send failed: ${error?.message || "Unknown mail error"}`);
  }
}
