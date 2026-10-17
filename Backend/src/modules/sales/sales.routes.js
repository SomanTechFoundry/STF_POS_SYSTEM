import { Router } from "express";
import { authGuard, requireRoles } from "../../middleware/auth.js";
import { createSaleController, listSalesController } from "./sales.controller.js";

const router = Router();

router.use(authGuard);
router.get("/", listSalesController);
router.post("/", requireRoles("admin", "owner"), createSaleController);

export default router;
