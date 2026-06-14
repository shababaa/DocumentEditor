import { apiFetch } from "./http.js"

export async function listDocuments() {
  return apiFetch("/documents")
}

// POST /documents body: { title, content? }
export async function createDocument(title, content="") {
  const res = await apiFetch("/documents", {
    method: "POST",
    body: JSON.stringify({ title, content }),
  })

  // some backends return {ok: true, doc: {...} }, or just return the doc directly
  return res?.doc ?? res
}


// GET /documents/:id
export async function getDocument(id) {
  const safeId = encodeURIComponent(id)
  return apiFetch(`/documents/${safeId}`)
}

// PUT /documents/:id/content body: { content }

export async function updateDocumentContent(id, content) {

  const safeId = encodeURIComponent(id)
  const res = await apiFetch(`/documents/${safeId}/content`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  })

  return res?.doc ?? res
}