import { requireSession } from "@/lib/auth/session";
import { listPrintTemplates } from "@/lib/services/printTemplates.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    await requireSession(req);
    const data = await listPrintTemplates();
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
