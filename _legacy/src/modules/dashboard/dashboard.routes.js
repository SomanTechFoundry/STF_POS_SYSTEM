import { Router } from "express";
import { authGuard } from "../../middleware/auth.js";
import { summaryController } from "./dashboard.controller.js";

const router = Router();

router.use(authGuard);
router.get("/summary", summaryController);

export default router;