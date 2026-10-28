import { clearSessionCookie } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

export async function POST() {
  try {
    await clearSessionCookie();
    return successResponse({ message: "Logged out" });
  } catch (err) {
    return errorResponse(err);
  }
}
