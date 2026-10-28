import { requireRoles, requireSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/users.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin");
    const data = await listUsers();
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
