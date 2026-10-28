import { Router } from "express";
import { authGuard, requireRoles } from "../../middleware/auth.js";
import {
  createCustomerController,
  deleteCustomerController,
  listCustomersController,
  updateCustomerController
} from "./customer.controller.js";

const router = Router();

router.use(authGuard);
router.get("/", listCustomersController);
router.post("/", requireRoles("admin", "owner"), createCustomerController);
router.patch("/:customerId", requireRoles("admin", "owner"), updateCustomerController);
router.delete("/:customerId", requireRoles("admin", "owner"), deleteCustomerController);

export default router;
