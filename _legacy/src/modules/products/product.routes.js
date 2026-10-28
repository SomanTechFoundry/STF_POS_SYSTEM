import { Router } from "express";
import { authGuard, requireRoles } from "../../middleware/auth.js";
import {
  createProductController,
  deleteProductController,
  listArchivedProductsController,
  listProductsController,
  restoreProductController,
  updateProductController
} from "./product.controller.js";

const router = Router();

router.use(authGuard);
router.get("/", listProductsController);
router.get("/archived", requireRoles("admin", "owner"), listArchivedProductsController);
router.post("/", requireRoles("admin", "owner"), createProductController);
router.patch("/:productId", requireRoles("admin", "owner"), updateProductController);
router.delete("/:productId", requireRoles("admin", "owner"), deleteProductController);
router.patch("/:productId/restore", requireRoles("admin", "owner"), restoreProductController);

export default router;
