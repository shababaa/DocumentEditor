import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { nord } from "@uiw/codemirror-theme-nord";
import { yCollab } from "y-codemirror.next";
import { useDocument } from "../hooks/useDocument";
import { useDocumentSocket } from "../hooks/useDocumentSocket";
import { addDocumentMember } from "../api/documents.js";

export default function EditorPage() {
  const { id } = useParams();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("editor");
  const [shareStatus, setShareStatus] = useState(null);
  const { document, loading, error: loadError } = useDocument(id);
  const {
    ydoc,
    ytext,
    undoManager,
    ready,
    connectionStatus,
    saveStatus,
    error: collaborationError,
  } = useDocumentSocket({
    id,
    enabled: !!document,
    canEdit: document?.role === "owner" || document?.role === "editor",
  });

  const collaborationExtension = useMemo(() => {
    if (!ytext || !undoManager) return null;
    return yCollab(ytext, null, { undoManager });
  }, [ytext, undoManager]);

  if (loading) return <h1>Loading document...</h1>;
  if (loadError) return <h1>{loadError}</h1>;
  if (!document) return <h1>Document not found</h1>;
  if (collaborationError && !ready) return <h1>{collaborationError}</h1>;
  if (!ready || !ytext || !collaborationExtension) {
    return <h1>Connecting to collaborative document...</h1>;
  }

  async function handleAddMember(event) {
    event.preventDefault();
    setShareStatus("Sharing...");
    try {
      await addDocumentMember(id, memberEmail, memberRole);
      setMemberEmail("");
      setShareStatus("Member added");
    } catch (shareError) {
      setShareStatus(shareError.message);
    }
  }

  return (
    <div>
      <Link to="/documents">Back</Link>

      <header>
        <h1>{document.title}</h1>
        <p>{saveStatus} · {connectionStatus}</p>
        {collaborationError && <p>{collaborationError}</p>}
      </header>

      {document.role === "owner" && (
        <form onSubmit={handleAddMember}>
          <input
            type="email"
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
            placeholder="Member email"
            required
          />
          <select
            value={memberRole}
            onChange={(event) => setMemberRole(event.target.value)}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit">Add member</button>
          {shareStatus && <span>{shareStatus}</span>}
        </form>
      )}

      <CodeMirror
        key={`${id}-${ydoc.clientID}`}
        value={ytext.toString()}
        editable={document.role !== "viewer"}
        extensions={[markdown(), collaborationExtension]}
        height="calc(100vh - 160px)"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
          history: false,
        }}
        theme={nord}
      />
    </div>
  );
}
