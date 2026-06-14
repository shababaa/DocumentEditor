import { v4 as uuidv4 } from "uuid";

import {
  listDocuments,
  getDocumentById,
  insertDocument,
  updateDocumentContent,
} from "../repositories/documents.repo.js";

export async function handleListDocuments(req, res, next) {
  try {
    const docs = await listDocuments()
    res.json(docs)
  } catch(err) {
    next(err)
  }
}

export async function handleGetDocument(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await getDocumentById(id)
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

    const id = uuidv4();
    const doc = await insertDocument({ id, title: title.trim(), content })
    res.status(201).json({ ok: true, doc })
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateContent(req, res, next) {
  try {
    const { id } = req.params
    const { content } = req.body

    if (typeof content !== "string") {
      return res.status(400).json({ ok: false, error: "content must be a string"})
    }
    
    const updated = await updateDocumentContent(id, content)

    if(!updated) return res.status(404).json({ ok: false, error: "Not found"})

    res.json({ok: true, doc: updated})
  } catch(err) {
    next(err)
  }
}