import { z } from "zod";
import { requireRoles, requireSession } from "@/lib/auth/session";
import { listTranslations } from "@/lib/services/users.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const listTranslationsSchema = z.object({
  businessId: z.string().uuid().optional(),
  entityType: z.enum(["product", "customer"]).default("product"),
  locale: z.string().min(2).default("ta-IN"),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(5),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin");
    const { searchParams } = new URL(req.url);
    const payload = listTranslationsSchema.parse({
      businessId: searchParams.get("businessId") ?? undefined,
      entityType: searchParams.get("entityType") ?? undefined,
      locale: searchParams.get("locale") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const data = await listTranslations({
      businessId: payload.businessId || session.businessId,
      entityType: payload.entityType,
      locale: payload.locale,
      search: payload.search || "",
      page: payload.page,
      pageSize: payload.pageSize,
    });
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
