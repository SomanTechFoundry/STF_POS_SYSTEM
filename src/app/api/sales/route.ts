import { z } from "zod";
import { getLocale, requireRoles, requireSession } from "@/lib/auth/session";
import { INVENTORY_LOCATION_CODES } from "@/lib/services/inventory.service";
import { createSale, listSales } from "@/lib/services/sales.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const optionalString = z.string().trim().optional().default("");

const customerInlineSchema = z.object({
  name: z.string().trim().min(2).optional(),
  address: optionalString,
  mobile: optionalString,
  email: optionalString,
});

const createSaleSchema = z.object({
  orderType: z.enum(["retail", "wholesale"]).default("retail"),
  customerId: z.string().uuid().nullable().optional(),
  customer: customerInlineSchema.optional(),
  wholesaleTinNo: optionalString,
  wholesaleFlPlSlNo: optionalString,
  sourceLocationCode: z
    .enum([INVENTORY_LOCATION_CODES.MAIN_STORE, INVENTORY_LOCATION_CODES.GODOWN])
    .default(INVENTORY_LOCATION_CODES.MAIN_STORE),
  paymentMode: z.enum(["cash", "upi", "card", "credit"]),
  discount: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().default(""),
  createdBy: z.string().min(2),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const data = await listSales(session.businessId);
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const payload = createSaleSchema.parse(await req.json());
    const data = await createSale(session.businessId, payload, getLocale(req));
    return successResponse(data, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
