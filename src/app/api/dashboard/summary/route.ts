import { z } from "zod";
import { getLocale, requireSession } from "@/lib/auth/session";
import { getSummary } from "@/lib/services/dashboard.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const dateField = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
);

const summaryQuerySchema = z.object({
  fromDate: dateField,
  toDate: dateField,
});

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const { searchParams } = new URL(req.url);
    const query = summaryQuerySchema.parse({
      fromDate: searchParams.get("fromDate") ?? undefined,
      toDate: searchParams.get("toDate") ?? undefined,
    });
    const data = await getSummary(session.businessId, {
      ...query,
      locale: getLocale(req),
    });
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
