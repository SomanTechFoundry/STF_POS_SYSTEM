import { Router } from "express";
import { approveController, loginController, registerController } from "./auth.controller.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/approve", approveController);

export default router;
