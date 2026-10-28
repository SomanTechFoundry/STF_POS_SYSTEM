import { z } from "zod";
import { requireRoles, requireSession } from "@/lib/auth/session";
import { updateTranslation } from "@/lib/services/users.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const updateTranslationSchema = z.object({
  businessId: z.string().uuid().optional(),
  entityType: z.enum(["product", "customer"]),
  entityId: z.string().uuid(),
  fieldName: z.string().min(1),
  locale: z.string().min(2),
  value: z.string().optional().default(""),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin");
    const payload = updateTranslationSchema.parse(await req.json());
    const data = await updateTranslation({
      businessId: payload.businessId || session.businessId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      fieldName: payload.fieldName,
      locale: payload.locale,
      value: payload.value || "",
    });
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
