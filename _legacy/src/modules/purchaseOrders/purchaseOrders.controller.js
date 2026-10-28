import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createPurchaseOrder, listPurchaseOrders } from "./purchaseOrders.service.js";
import { INVENTORY_LOCATION_CODES } from "../inventory/inventoryLocation.service.js";

const createPurchaseOrderSchema = z.object({
  supplierName: z.string().trim().optional().default(""),
  receiveLocationCode: z.enum([INVENTORY_LOCATION_CODES.MAIN_STORE, INVENTORY_LOCATION_CODES.GODOWN]).default(INVENTORY_LOCATION_CODES.GODOWN),
  paymentMode: z.enum(["cash", "upi", "card", "credit"]),
  notes: z.string().optional().default(""),
  createdBy: z.string().trim().min(2),
  items: z.array(
    z.object({
      variantId: z.string().uuid(),
      qty: z.coerce.number().int().positive()
    })
  ).min(1)
});

export const listPurchaseOrdersController = asyncHandler(async (req, res) => {
  const data = await listPurchaseOrders(req.user.businessId);
  res.json({ success: true, data });
});

export const createPurchaseOrderController = asyncHandler(async (req, res) => {
  const payload = createPurchaseOrderSchema.parse(req.body);
  const data = await createPurchaseOrder(req.user.businessId, payload);
  res.status(201).json({ success: true, data });
});
