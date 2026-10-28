import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getEnv } from "@/lib/env";
import { ApiError } from "@/lib/errors";

export const SESSION_COOKIE = "stf_pos_session";

export type SessionUser = {
  userId: string;
  role: string;
  businessId: string;
  email: string;
  impersonatedBusinessId?: string;
  isImpersonating?: boolean;
};

export function signAccessToken(user: {
  id: string;
  role: string;
  businessId: string;
  email: string;
}) {
  const env = getEnv();
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      businessId: user.businessId,
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): SessionUser {
  try {
    const payload = jwt.verify(token, getEnv().JWT_SECRET) as jwt.JwtPayload;
    return {
      userId: String(payload.userId),
      role: String(payload.role),
      businessId: String(payload.businessId),
      email: String(payload.email),
    };
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return verifyAccessToken(auth.slice(7));
  }

  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  return verifyAccessToken(cookie);
}

export async function requireSession(req: Request): Promise<SessionUser> {
  const session = await getSessionFromRequest(req);
  if (!session) throw new ApiError(401, "Authorization token is required");

  const impersonate = req.headers.get("x-business-id");
  if (session.role.toLowerCase() === "admin" && impersonate) {
    return {
      ...session,
      businessId: impersonate,
      impersonatedBusinessId: impersonate,
      isImpersonating: true,
    };
  }

  return session;
}

export function requireRoles(session: SessionUser, ...roles: string[]) {
  const role = session.role.toLowerCase();
  if (!roles.map((r) => r.toLowerCase()).includes(role)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}

export function getLocale(req: Request): string {
  const header = req.headers.get("x-locale") || req.headers.get("accept-language") || "en-IN";
  if (header.toLowerCase().startsWith("ta")) return "ta-IN";
  return header.split(",")[0]?.trim() || "en-IN";
}
