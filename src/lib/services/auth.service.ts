import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { appUrl, getEnv } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { sendSignupApprovalEmail } from "@/lib/mailer";
import { signAccessToken } from "@/lib/auth/session";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveRoleForEmail(email: string) {
  return normalizeEmail(email) === normalizeEmail(getEnv().ADMIN_EMAIL) ? "admin" : "owner";
}

function publicUser(user: {
  id: string;
  businessId: string;
  businessName: string;
  businessProfileId: string;
  fullName: string;
  email: string;
  role: string;
}) {
  return {
    id: user.id,
    business_id: user.businessId,
    business_name: user.businessName,
    business_profile_id: user.businessProfileId,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
  };
}

export async function register(payload: {
  businessName: string;
  businessProfileId: string;
  fullName: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = normalizeEmail(payload.email);
  const existing = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new ApiError(409, "Email already exists");

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const approvalToken = crypto.randomBytes(32).toString("hex");

  await prisma.signupRequest.upsert({
    where: { email: normalizedEmail },
    create: {
      businessName: payload.businessName,
      businessProfileId: payload.businessProfileId,
      fullName: payload.fullName,
      email: normalizedEmail,
      passwordHash,
      approvalToken,
      status: "pending",
    },
    update: {
      businessName: payload.businessName,
      businessProfileId: payload.businessProfileId,
      fullName: payload.fullName,
      passwordHash,
      approvalToken,
      status: "pending",
      approvedAt: null,
      approvedByEmail: null,
      requestedAt: new Date(),
    },
  });

  const approveUrl = `${appUrl()}/api/auth/approve?token=${approvalToken}`;
  await sendSignupApprovalEmail({
    requester: {
      businessName: payload.businessName,
      fullName: payload.fullName,
      email: normalizedEmail,
    },
    approveUrl,
  });

  return {
    message: "Signup request submitted. Access will be enabled after admin approval.",
    email: normalizedEmail,
    status: "pending_approval",
  };
}

export async function approveSignupRequest(token: string, approverEmail: string) {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.signupRequest.findFirst({
      where: { approvalToken: token, status: "pending" },
    });
    if (!pending) throw new ApiError(400, "Invalid or expired approval link");

    const role = resolveRoleForEmail(pending.email);
    await tx.appUser.upsert({
      where: { email: pending.email },
      create: {
        businessName: pending.businessName,
        businessProfileId: pending.businessProfileId,
        fullName: pending.fullName,
        email: pending.email,
        passwordHash: pending.passwordHash,
        role,
        isActive: true,
      },
      update: { role, isActive: true },
    });

    await tx.signupRequest.update({
      where: { id: pending.id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedByEmail: approverEmail,
      },
    });

    return { message: "Signup approved successfully", email: pending.email };
  });
}

export async function login(payload: { email: string; password: string }) {
  const normalizedEmail = normalizeEmail(payload.email);
  let user = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    const pending = await prisma.signupRequest.findUnique({ where: { email: normalizedEmail } });
    if (pending?.status === "pending") {
      throw new ApiError(403, "Signup is pending approval. Please wait for admin confirmation.");
    }
    throw new ApiError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid credentials");
  if (!user.isActive) throw new ApiError(403, "Your account is currently disabled. Contact admin.");

  if (normalizedEmail === normalizeEmail(getEnv().ADMIN_EMAIL) && user.role !== "admin") {
    user = await prisma.appUser.update({
      where: { id: user.id },
      data: { role: "admin", isActive: true },
    });
  }

  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    businessId: user.businessId,
    email: user.email,
  });

  return { user: publicUser(user), accessToken };
}
