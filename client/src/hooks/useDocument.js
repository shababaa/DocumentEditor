import { useEffect, useState, useRef } from "react";
import { getDocument, updateDocumentContent } from "../api/documents";

export function useDocument(id) {
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");

  const lastSavedContentRef = useRef("");

  useEffect(() => {
    async function loadDocument() {
      try {
        setLoading(true);
        setError(null);

        const doc = await getDocument(id);

        setDocument(doc);
        setContent(doc.content ?? "");
        lastSavedContentRef.current = doc.content ?? "";
        setSaveStatus("saved");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadDocument();
    }
  }, [id]);

  useEffect(() => {
    if (!document) return;
    if (content === lastSavedContentRef.current) return;

    setSaveStatus("saving");

    const timer = setTimeout(async () => {
      try {
        await updateDocumentContent(id, content);
        lastSavedContentRef.current = content;
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        setError(err.message);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [content, id, document]);

  return {
    document,
    content,
    setContent,
    loading,
    error,
    saveStatus,
  };
}