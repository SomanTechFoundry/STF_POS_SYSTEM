import { Router } from "express";
import { authGuard, requireRoles } from "../../middleware/auth.js";
import { listBusinessesController, listTranslationsController, listUsersController, updateTranslationController, updateUserController } from "./user.controller.js";

const router = Router();

router.use(authGuard);
router.use(requireRoles("admin"));

router.get("/", listUsersController);
router.get("/businesses", listBusinessesController);
router.get("/translations", listTranslationsController);
router.patch("/:userId", updateUserController);
router.patch("/translations/item", updateTranslationController);

export default router;
