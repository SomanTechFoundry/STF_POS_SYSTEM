import { z } from "zod";
import { requireRoles, requireSession } from "@/lib/auth/session";
import { INVENTORY_LOCATION_CODES } from "@/lib/services/inventory.service";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/services/purchaseOrders.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const createPurchaseOrderSchema = z.object({
  supplierName: z.string().trim().optional().default(""),
  receiveLocationCode: z
    .enum([INVENTORY_LOCATION_CODES.MAIN_STORE, INVENTORY_LOCATION_CODES.GODOWN])
    .default(INVENTORY_LOCATION_CODES.GODOWN),
  paymentMode: z.enum(["cash", "upi", "card", "credit"]),
  notes: z.string().optional().default(""),
  createdBy: z.string().trim().min(2),
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
    requireRoles(session, "admin", "owner");
    const data = await listPurchaseOrders(session.businessId);
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const payload = createPurchaseOrderSchema.parse(await req.json());
    const data = await createPurchaseOrder(session.businessId, payload);
    return successResponse(data, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
