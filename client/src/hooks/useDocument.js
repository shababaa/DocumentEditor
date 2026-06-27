import { useEffect, useState } from "react";
import { getDocument } from "../api/documents";

export function useDocument(id) {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDocument() {
      try {
        setLoading(true);
        setError(null);
        setDocument(await getDocument(id));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (id) loadDocument();
  }, [id]);

  return { document, loading, error };
}
