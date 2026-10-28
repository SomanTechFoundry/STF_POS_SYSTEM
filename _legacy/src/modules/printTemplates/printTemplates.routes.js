import { Router } from "express";
import { authGuard, requireRoles } from "../../middleware/auth.js";
import {
  getCurrentPrintTemplateController,
  listPrintTemplatesController,
  setCurrentPrintTemplateController
} from "./printTemplates.controller.js";

const router = Router();

router.use(authGuard);
router.get("/", listPrintTemplatesController);
router.get("/current", getCurrentPrintTemplateController);
router.put("/current", requireRoles("admin", "owner"), setCurrentPrintTemplateController);

export default router;
