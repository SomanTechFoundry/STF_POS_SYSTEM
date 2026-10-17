import { z } from "zod";
import env from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { approveSignupRequest, login, register } from "./auth.service.js";

const registerSchema = z.object({
  businessName: z.string().min(2),
  businessProfileId: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const approveSchema = z.object({
  token: z.string().min(20)
});

export const registerController = asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const data = await register(payload);
  res.status(202).json({ success: true, data });
});

export const loginController = asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const data = await login(payload);
  res.json({ success: true, data });
});

export const approveController = asyncHandler(async (req, res) => {
  const { token } = approveSchema.parse(req.query);

  await approveSignupRequest({
    token,
    approverEmail: env.APPROVAL_TO_EMAIL || "approver"
  });

  const redirectUrl = new URL("/login", env.FRONTEND_BASE_URL);
  redirectUrl.searchParams.set("approved", "1");

  res.redirect(302, redirectUrl.toString());
});
