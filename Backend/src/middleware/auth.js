import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function authGuard(req, _res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.split(" ")[1] : null;

  if (!token) {
    return next(new ApiError(401, "Authorization token is required"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    const rawBusinessId = req.headers["x-business-id"];
    const impersonationId = typeof rawBusinessId === "string" && UUID_REGEX.test(rawBusinessId)
      ? rawBusinessId
      : null;

    if (payload?.role === "admin" && impersonationId) {
      req.user = {
        ...payload,
        businessId: impersonationId,
        impersonatedBusinessId: impersonationId,
        isImpersonating: true
      };
    } else {
      req.user = payload;
    }

    return next();
  } catch (_error) {
    return next(new ApiError(401, "Invalid or expired token"));
  }
}

export function requireRoles(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((role) => String(role).toLowerCase());

  return (req, _res, next) => {
    const currentRole = String(req.user?.role || "").toLowerCase();
    if (!normalizedAllowed.includes(currentRole)) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }

    return next();
  };
}
