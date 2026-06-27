import { Router } from "express";
import {
  handleListDocuments,
  handleGetDocument,
  handleCreateDocument,
  handleGenerateFromCode,
  handleUpdateContent,
  handleListMembers,
  handleAddMember,
} from "../controllers/documents.controller.js"
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", handleListDocuments)
router.post("/", handleCreateDocument)
router.post("/generate-from-code", handleGenerateFromCode)
router.get("/:id/members", handleListMembers)
router.post("/:id/members", handleAddMember)
router.get("/:id", handleGetDocument)

// clear endpoint name for autosave
router.put("/:id/content", handleUpdateContent);

export default router;
