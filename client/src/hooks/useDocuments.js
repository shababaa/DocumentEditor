import { useCallback, useState, useEffect } from "react"
import { listDocuments, createDocument } from "../api/documents.js"

export function useDocuments({
  autoLoad = true,
  initialDocuments = [],
} = {}) {
  const [documents, setDocuments] = useState(initialDocuments)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const docs = await listDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const createDoc = useCallback(async (title) => {
    const cleanTitle = String(title ?? "").trim()
    if(!cleanTitle) {
      setCreateError("Title is required")
      return null
    }

    setCreating(true)
    setCreateError(null)

    try {
      const newDoc = await createDocument(cleanTitle)
      // TODO: try catch block to cLeanLy implement createDocument
      setDocuments((prev) => [newDoc, ...prev])
      return newDoc
    } catch(err) {
      setCreateError(err?.message ?? String(err))
      return null
    } finally {
      setCreating(false)
    }
  }, []);
  
  useEffect(() => {
    if(!autoLoad) return;
    reload();
  }, [autoLoad, reload])

  return {
    documents,
    loading,
    error,
    reload,
    createDoc,
    creating,
    createError,
  };
};