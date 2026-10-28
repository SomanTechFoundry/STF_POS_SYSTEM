import { getLocale, requireRoles, requireSession } from "@/lib/auth/session";
import { listArchivedProducts } from "@/lib/services/products.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const data = await listArchivedProducts(session.businessId, getLocale(req));
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
