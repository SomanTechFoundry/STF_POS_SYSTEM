import { z } from "zod";
import { requireRoles, requireSession } from "@/lib/auth/session";
import { restoreProduct } from "@/lib/services/products.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const paramsSchema = z.object({
  productId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ productId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const { productId } = paramsSchema.parse(await ctx.params);
    const data = await restoreProduct(session.businessId, productId);
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
