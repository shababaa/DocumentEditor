import { Router } from "express";
import {
  handleListDocuments,
  handleGetDocument,
  handleCreateDocument,
  handleUpdateContent,
} from "../controllers/documents.controller.js"

const router = Router();

router.get("/", handleListDocuments)
router.post("/", handleCreateDocument)
router.get("/:id", handleGetDocument)

// clear endpoint name for autosave
router.put("/:id/content", handleUpdateContent);

export default router;