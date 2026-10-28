import { Router } from "express";
import { authGuard, requireRoles } from "../../middleware/auth.js";
import { createPurchaseOrderController, listPurchaseOrdersController } from "./purchaseOrders.controller.js";

const router = Router();

router.use(authGuard);
router.get("/", requireRoles("admin", "owner"), listPurchaseOrdersController);
router.post("/", requireRoles("admin", "owner"), createPurchaseOrderController);

export default router;

