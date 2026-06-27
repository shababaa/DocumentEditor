import { Router } from "express";

import {
  handleLogin,
  handleLogout,
  handleMe,
  handleSignup,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", handleSignup);
router.post("/login", handleLogin);
router.post("/logout", handleLogout);
router.get("/me", requireAuth, handleMe);

export default router;
