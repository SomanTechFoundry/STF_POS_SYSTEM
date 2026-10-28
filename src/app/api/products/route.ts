import { z } from "zod";
import { getLocale, requireRoles, requireSession } from "@/lib/auth/session";
import { createProduct, listProducts } from "@/lib/services/products.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(2),
  unitType: z.enum(["ml", "g", "kg", "ltr", "pcs"]).default("pcs"),
  unitSize: z.coerce.number().positive().default(1),
  costPrice: z.coerce.number().nonnegative().default(0),
  salePrice: z.coerce.number().positive(),
  stockQty: z.coerce.number().int().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative(),
});

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  variants: z.array(variantSchema).min(1),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const data = await listProducts(session.businessId, getLocale(req));
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const payload = productSchema.parse(await req.json());
    const data = await createProduct(session.businessId, payload, getLocale(req));
    return successResponse(data, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
