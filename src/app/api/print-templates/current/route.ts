import { z } from "zod";
import { getLocale, requireRoles, requireSession } from "@/lib/auth/session";
import {
  getCurrentPrintTemplate,
  updateCurrentPrintTemplate,
} from "@/lib/services/printTemplates.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const updateCurrentSchema = z.object({
  templateKey: z.string().min(2),
  billProfile: z.record(z.string(), z.string()).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const data = await getCurrentPrintTemplate(session.businessId, getLocale(req));
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const payload = updateCurrentSchema.parse(await req.json());
    const data = await updateCurrentPrintTemplate(
      session.businessId,
      getLocale(req),
      payload.templateKey,
      payload.billProfile,
    );
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
