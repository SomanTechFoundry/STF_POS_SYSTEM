import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { ApiError } from "@/lib/errors";

export async function sendSignupApprovalEmail(input: {
  requester: { businessName: string; fullName: string; email: string };
  approveUrl: string;
}) {
  const env = getEnv();
  if (!env.APPROVAL_TO_EMAIL) {
    throw new ApiError(500, "APPROVAL_TO_EMAIL is not configured");
  }

  const subject = `STF POS signup approval: ${input.requester.businessName}`;
  const text = [
    "A new POS signup request needs approval.",
    "",
    `Business: ${input.requester.businessName}`,
    `Name: ${input.requester.fullName}`,
    `Email: ${input.requester.email}`,
    "",
    `Approve: ${input.approveUrl}`,
  ].join("\n");

  if (env.BREVO_API_KEY) {
    const res = await fetch(env.BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: env.SMTP_FROM_EMAIL || env.APPROVAL_TO_EMAIL,
          name: "STF POS",
        },
        to: [{ email: env.APPROVAL_TO_EMAIL }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(502, `Failed to send approval email via Brevo: ${body}`);
    }
    return;
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("[mailer] No Brevo/SMTP configured — logging approve URL instead");
    console.info(text);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: Boolean(env.SMTP_SECURE),
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM_EMAIL || env.SMTP_USER,
    to: env.APPROVAL_TO_EMAIL,
    subject,
    text,
  });
}
