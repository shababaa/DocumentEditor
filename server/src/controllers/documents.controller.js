import { randomUUID } from "node:crypto";

import {
  listDocuments,
  getDocumentForUser,
  insertDocument,
  updateDocumentContent,
  getDocumentRole,
  listDocumentMembers,
  addDocumentMember,
  updateDocumentMemberRole,
} from "../repositories/documents.repo.js";
import { publishPermissionChange } from "../services/permissionEvents.service.js";
import {
  DocumentGenerationError,
  generateDocumentation,
} from "../services/documentGeneration.service.js";

// Leaves room for the "Documentation: " prefix in a VARCHAR(255) title.
const MAX_FILENAME_LENGTH = 240;
const MAX_LANGUAGE_LENGTH = 100;
const MAX_CODE_LENGTH = 500_000;

export async function handleListDocuments(req, res, next) {
  try {
    const docs = await listDocuments(req.user.id)
    res.json(docs)
  } catch(err) {
    next(err)
  }
}

export async function handleGetDocument(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await getDocumentForUser(id, req.user.id)
    if(!doc) return res.status(404).json({ ok: false, error: "Not found" })
    res.json(doc);
  } catch(err) {
    next(err);
  }
}

export async function handleCreateDocument(req, res, next) {
  try {
    const { title, content = ""} = req.body;
    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "title is required" });
    }
    if (typeof content !== "string") {
      return res.status(400).json({ ok: false, error: "content is required"})
    }

    const id = randomUUID();
    const doc = await insertDocument({
      id,
      title: title.trim(),
      content,
      ownerUserId: req.user.id,
    })
    res.status(201).json({ ok: true, doc })
  } catch (err) {
    next(err)
  }
}

export async function handleGenerateFromCode(req, res, next) {
  try {
    const { filename, language, code } = req.body ?? {};

    if (typeof filename !== "string" || filename.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: "filename must be a non-empty string",
      });
    }
    if (filename.trim().length > MAX_FILENAME_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: `filename must be ${MAX_FILENAME_LENGTH} characters or fewer`,
      });
    }
    if (/[\r\n]/.test(filename)) {
      return res.status(400).json({
        ok: false,
        error: "filename must not contain line breaks",
      });
    }
    if (typeof language !== "string" || language.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: "language must be a non-empty string",
      });
    }
    if (language.trim().length > MAX_LANGUAGE_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: `language must be ${MAX_LANGUAGE_LENGTH} characters or fewer`,
      });
    }
    if (/[\r\n]/.test(language)) {
      return res.status(400).json({
        ok: false,
        error: "language must not contain line breaks",
      });
    }
    if (typeof code !== "string" || code.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: "code must be a non-empty string",
      });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: `code must be ${MAX_CODE_LENGTH} characters or fewer`,
      });
    }

    const cleanFilename = filename.trim();
    const content = await generateDocumentation({
      filename: cleanFilename,
      language: language.trim(),
      code,
    });
    const doc = await insertDocument({
      id: randomUUID(),
      title: `Documentation: ${cleanFilename}`,
      content,
      ownerUserId: req.user.id,
    });

    return res.status(201).json({ ok: true, doc });
  } catch (err) {
    if (err instanceof DocumentGenerationError) {
      return res.status(502).json({ ok: false, error: err.message });
    }
    return next(err);
  }
}

export async function handleUpdateContent(req, res, next) {
  try {
    const { id } = req.params
    const { content } = req.body

    if (typeof content !== "string") {
      return res.status(400).json({ ok: false, error: "content must be a string"})
    }
    
    const updated = await updateDocumentContent(id, content, req.user.id)

    if(!updated) return res.status(404).json({ ok: false, error: "Not found"})

    res.json({ok: true, doc: updated})
  } catch(err) {
    next(err)
  }
}

export async function handleListMembers(req, res, next) {
  try {
    const role = await getDocumentRole(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ ok: false, error: "Not found" });
    const members = await listDocumentMembers(req.params.id);
    return res.json({ ok: true, members });
  } catch (error) {
    return next(error);
  }
}

export async function handleUpdateMemberRole(req, res, next) {
  try {
    const { role } = req.body ?? {};
    if (!["editor", "viewer"].includes(role)) {
      return res.status(400).json({ ok: false, error: "role must be editor or viewer" });
    }

    const result = await updateDocumentMemberRole({
      documentId: req.params.id,
      ownerUserId: req.user.id,
      memberUserId: req.params.userId,
      role,
    });
    if (result.status === "forbidden") {
      return res.status(403).json({ ok: false, error: "Owner access required" });
    }
    if (result.status === "not-found") {
      return res.status(404).json({ ok: false, error: "Member not found" });
    }
    if (result.status === "owner-immutable") {
      return res.status(400).json({ ok: false, error: "The owner role cannot be changed" });
    }

    publishPermissionChange({
      documentId: req.params.id,
      userId: req.params.userId,
      role,
    });
    const members = await listDocumentMembers(req.params.id);
    return res.json({ ok: true, members });
  } catch (error) {
    return next(error);
  }
}

export async function handleAddMember(req, res, next) {
  try {
    const { email, role } = req.body ?? {};
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "A valid email is required" });
    }
    if (!["editor", "viewer"].includes(role)) {
      return res.status(400).json({
        ok: false,
        error: "role must be editor or viewer",
      });
    }

    const result = await addDocumentMember({
      documentId: req.params.id,
      ownerUserId: req.user.id,
      email: email.trim().toLowerCase(),
      role,
    });
    if (result.status === "forbidden") {
      return res.status(403).json({ ok: false, error: "Owner access required" });
    }
    if (result.status === "user-not-found") {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const members = await listDocumentMembers(req.params.id);
    return res.status(201).json({ ok: true, members });
  } catch (error) {
    return next(error);
  }
}
