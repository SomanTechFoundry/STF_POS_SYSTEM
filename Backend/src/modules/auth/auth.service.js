import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import env from "../../config/env.js";
import { pool, query } from "../../db/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendSignupApprovalEmail } from "../../utils/mailer.js";

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      businessId: user.business_id,
      email: user.email
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function resolveRoleForEmail(email) {
  return normalizeEmail(email) === normalizeEmail(env.ADMIN_EMAIL) ? "admin" : "owner";
}

export async function register(payload) {
  const { businessName, businessProfileId, fullName, email, password } = payload;
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await query("SELECT id FROM app_user WHERE email = $1", [normalizedEmail]);
  if (existingUser.rowCount > 0) {
    throw new ApiError(409, "Email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const approvalToken = crypto.randomBytes(32).toString("hex");

  await query(
    `INSERT INTO signup_request (business_name, business_profile_id, full_name, email, password_hash, approval_token, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (email)
     DO UPDATE SET
       business_name = EXCLUDED.business_name,
       business_profile_id = EXCLUDED.business_profile_id,
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       approval_token = EXCLUDED.approval_token,
       status = 'pending',
       approved_at = NULL,
       approved_by_email = NULL,
       requested_at = NOW()`,
    [businessName, businessProfileId, fullName, normalizedEmail, passwordHash, approvalToken]
  );

  const approveUrl = `${env.BACKEND_PUBLIC_URL}/api/auth/approve?token=${approvalToken}`;

  await sendSignupApprovalEmail({
    requester: {
      businessName,
      fullName,
      email: normalizedEmail
    },
    approveUrl
  });

  return {
    message: "Signup request submitted. Access will be enabled after admin approval.",
    email: normalizedEmail,
    status: "pending_approval"
  };
}

export async function approveSignupRequest(payload) {
  const { token, approverEmail } = payload;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pendingResult = await client.query(
      `SELECT id, business_name, business_profile_id, full_name, email, password_hash
       FROM signup_request
       WHERE approval_token = $1 AND status = 'pending'
       FOR UPDATE`,
      [token]
    );

    if (pendingResult.rowCount === 0) {
      throw new ApiError(400, "Invalid or expired approval link");
    }

    const request = pendingResult.rows[0];
    const role = resolveRoleForEmail(request.email);

    await client.query(
      `INSERT INTO app_user (business_name, business_profile_id, full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (email)
       DO UPDATE SET role = EXCLUDED.role, is_active = true`,
      [
        request.business_name,
        request.business_profile_id,
        request.full_name,
        request.email,
        request.password_hash,
        role
      ]
    );

    await client.query(
      `UPDATE signup_request
       SET status = 'approved', approved_at = NOW(), approved_by_email = $2
       WHERE id = $1`,
      [request.id, approverEmail]
    );

    await client.query("COMMIT");

    return {
      message: "Signup approved successfully",
      email: request.email
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function login(payload) {
  const { email, password } = payload;
  const normalizedEmail = normalizeEmail(email);

  const result = await query(
    "SELECT id, business_name, business_profile_id, full_name, email, password_hash, role, business_id, is_active FROM app_user WHERE email = $1",
    [normalizedEmail]
  );

  if (result.rowCount === 0) {
    const pendingResult = await query(
      "SELECT status FROM signup_request WHERE email = $1",
      [normalizedEmail]
    );

    if (pendingResult.rowCount > 0) {
      const pendingStatus = pendingResult.rows[0].status;
      if (pendingStatus === "pending") {
        throw new ApiError(403, "Signup is pending approval. Please wait for admin confirmation.");
      }
    }

    throw new ApiError(401, "Invalid credentials");
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.is_active) {
    throw new ApiError(403, "Your account is currently disabled. Contact admin.");
  }

  if (normalizedEmail === normalizeEmail(env.ADMIN_EMAIL) && user.role !== "admin") {
    const adminResult = await query(
      `UPDATE app_user
       SET role = 'admin', is_active = true
       WHERE id = $1
       RETURNING id, business_name, business_profile_id, full_name, email, role, business_id`,
      [user.id]
    );

    const adminUser = adminResult.rows[0];
    const accessToken = signToken(adminUser);
    return { user: adminUser, accessToken };
  }

  const accessToken = signToken(user);
  delete user.password_hash;
  delete user.is_active;

  return { user, accessToken };
}
