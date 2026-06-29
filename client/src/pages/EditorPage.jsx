import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { yCollab } from "y-codemirror.next";
import { useDocument } from "../hooks/useDocument";
import { useDocumentSocket } from "../hooks/useDocumentSocket";
import { addDocumentMember, listDocumentMembers, updateDocumentMemberRole } from "../api/documents.js";
import WorkspaceLayout from "../components/WorkspaceLayout.jsx";
import Icon from "../components/Icon.jsx";
import { documentMeta, formatRelativeTime } from "../utils/documentPresentation.js";

function EditorLoading({ title, message, error = false }) {
  return (
    <WorkspaceLayout className="editor-shell">
      <main className="editor-state grid-backdrop">
        <span className={`editor-state__icon ${error ? "editor-state__icon--error" : ""}`}><Icon name={error ? "activity" : "document"} size={24} /></span>
        <h1>{title}</h1><p>{message}</p>
        {error && <Link className="button button--secondary" to="/documents"><Icon name="chevronLeft" size={16} />Back to documents</Link>}
      </main>
    </WorkspaceLayout>
  );
}

function initials(email = "") {
  return email.split("@")[0].slice(0, 2).toUpperCase() || "DE";
}

export default function EditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("editor");
  const [shareStatus, setShareStatus] = useState(null);
  const [shareOpen, setShareOpen] = useState(() => Boolean(location.state?.openShare));
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const { document, loading, error: loadError } = useDocument(id);
  const {
    ydoc,
    ytext,
    undoManager,
    ready,
    connectionStatus,
    saveStatus,
    presence,
    permissionRole,
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

  useEffect(() => {
    if (!document) return undefined;
    let active = true;
    listDocumentMembers(id)
      .then((nextMembers) => {
        if (active) {
          setMembers(nextMembers);
          setMembersError(null);
        }
      })
      .catch((nextError) => {
        if (active) setMembersError(nextError.message);
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, document, permissionRole]);

  useEffect(() => {
    if (!previewMode || !ytext) return undefined;
    const updatePreview = () => setPreviewContent(ytext.toString());
    ytext.observe(updatePreview);
    return () => ytext.unobserve(updatePreview);
  }, [previewMode, ytext]);

  async function handleAddMember(event) {
    event.preventDefault();
    setShareStatus("Sharing...");
    try {
      const response = await addDocumentMember(id, memberEmail, memberRole);
      setMembers(response?.members ?? []);
      setMemberEmail("");
      setShareStatus("Member added successfully");
    } catch (shareError) {
      setShareStatus(shareError.message);
    }
  }

  async function handleRoleChange(member, role) {
    setUpdatingMemberId(member.id);
    setMembersError(null);
    try {
      const response = await updateDocumentMemberRole(id, member.id, role);
      setMembers(response?.members ?? []);
    } catch (nextError) {
      setMembersError(nextError.message);
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function copyDocumentLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function togglePreview() {
    if (!previewMode) setPreviewContent(ytext?.toString() ?? "");
    setPreviewMode(!previewMode);
  }

  function downloadMarkdown() {
    const fallbackName = meta.generated ? meta.source : document.title;
    const baseName = fallbackName
      .replace(/\.md$/i, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "docuedit-document";
    const blob = new Blob([ytext.toString()], { type: "text/markdown;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = downloadUrl;
    link.download = `${baseName}.md`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  if (loading) return <EditorLoading title="Opening document" message="Loading permissions and document metadata…" />;
  if (loadError) return <EditorLoading error title="Couldn’t open this document" message={loadError} />;
  if (!document) return <EditorLoading error title="Document not found" message="This document may have been removed or you may not have access." />;
  if (collaborationError && !ready) return <EditorLoading error title="Collaboration unavailable" message={collaborationError} />;
  if (!ready || !ytext || !collaborationExtension) return <EditorLoading title="Joining the live document" message="Connecting to the secure Yjs collaboration room…" />;

  const meta = documentMeta(document);
  const effectiveRole = permissionRole || document.role;
  const canEdit = effectiveRole !== "viewer";

  return (
    <WorkspaceLayout className="editor-shell">
      <main className={`editor-workspace ${detailsOpen ? "editor-workspace--details" : ""}`}>
        <header className="editor-header">
          <div className="editor-header__identity">
            <Link className="icon-button" to="/documents" aria-label="Back to documents" title="Back to documents"><Icon name="chevronLeft" size={18} /></Link>
            <span className={`file-glyph ${meta.generated ? "file-glyph--generated" : ""}`}><Icon name={meta.generated ? "fileCode" : "document"} size={18} /></span>
            <div><div className="editor-breadcrumb"><Link to="/documents">Documents</Link><span>/</span><span>{meta.generated ? meta.source : "Workspace"}</span></div><h1>{document.title}</h1></div>
          </div>
          <div className="editor-header__status">
            <span className={`connection-pill connection-pill--${connectionStatus}`}><span className="status-dot" />{connectionStatus === "connected" ? "Live" : "Reconnecting"}</span>
            <span className={`save-state save-state--${saveStatus}`}>{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : "All changes saved"}</span>
          </div>
          <div className="editor-header__actions">
            <div className="avatar-stack live-avatars" aria-label={`${presence.length} online`}>
              {presence.slice(0, 3).map((person) => <span key={person.id} title={person.email}>{initials(person.email)}</span>)}
              {presence.length > 3 && <span>+{presence.length - 3}</span>}
            </div>
            <button className={`preview-button ${previewMode ? "preview-button--active" : ""}`} type="button" onClick={togglePreview}><Icon name={previewMode ? "edit" : "eye"} size={15} /><span>{previewMode ? "Edit" : "Preview"}</span></button>
            <button className="download-button" type="button" onClick={downloadMarkdown} title="Download Markdown"><Icon name="download" size={15} /><span>Download</span></button>
            {effectiveRole === "owner" && <button className="button button--secondary button--small" type="button" onClick={() => setShareOpen(true)}><Icon name="share" size={15} />Share</button>}
            <button className="button button--secondary button--small" type="button" onClick={() => setMembersOpen(true)}><Icon name="users" size={15} />Members <span className="members-count">{members.length}</span></button>
            <button className={`icon-button ${detailsOpen ? "icon-button--active" : ""}`} type="button" onClick={() => setDetailsOpen((open) => !open)} aria-label="Toggle document details" title="Document details"><Icon name="panel" size={17} /></button>
          </div>
        </header>

        {collaborationError && <div className="editor-alert"><Icon name="activity" size={16} />{collaborationError}</div>}
        {!canEdit && <div className="viewer-banner"><Icon name="users" size={16} /><span>You’re viewing this document in read-only mode.</span></div>}

        <div className="editor-body">
          <section className="writing-stage">
            <div className={`writing-surface ${previewMode ? "writing-surface--preview" : ""}`}>
              <div className="writing-surface__meta">
                {meta.generated ? <span className="badge badge--generated"><Icon name="sparkles" size={11} />Generated from {meta.source}</span> : <span className="badge"><Icon name="document" size={11} />Markdown document</span>}
                <span>{meta.language}</span>
                {previewMode && <span className="preview-label"><span />Rendered preview</span>}
              </div>
              {previewMode ? (
                <article className="markdown-preview">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
                    }}
                  >
                    {previewContent}
                  </ReactMarkdown>
                </article>
              ) : (
                <CodeMirror
                  key={`${id}-${ydoc.clientID}`}
                  value={ytext.toString()}
                  editable={canEdit}
                  extensions={[markdown(), collaborationExtension]}
                  height="calc(100vh - 230px)"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    history: false,
                  }}
                />
              )}
            </div>
            <footer className="editor-footer"><span><Icon name={previewMode ? "eye" : "code"} size={13} />{previewMode ? "Preview" : "Markdown"}</span><span>UTF-8</span><span className="editor-footer__spacer" /><span><span className="status-dot" />Yjs synced</span><span>{previewMode ? "Rendered" : canEdit ? "Editing" : "Viewing"}</span></footer>
          </section>

          {detailsOpen && (
            <aside className="document-details">
              <div className="details-heading"><div><span className="section-kicker">Document</span><h2>Details</h2></div><button className="icon-button" type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details"><Icon name="chevronRight" size={17} /></button></div>
              <div className="details-group">
                <h3>Source</h3>
                <dl><div><dt>Origin</dt><dd><Icon name={meta.generated ? "vscode" : "document"} size={14} />{meta.generated ? "VS Code" : "Web workspace"}</dd></div><div><dt>File</dt><dd>{meta.source}</dd></div><div><dt>Language</dt><dd><span className="language-pill">{meta.language}</span></dd></div></dl>
              </div>
              <div className="details-group">
                <h3>Access</h3>
                <dl><div><dt>Your role</dt><dd className="role-value"><span className={`role-dot role-dot--${effectiveRole}`} />{effectiveRole}</dd></div><div><dt>Collaboration</dt><dd><span className="status-dot" />Connected</dd></div></dl>
              </div>
              <div className="details-group">
                <h3>Activity</h3>
                <p className="details-activity"><span><Icon name="clock" size={14} /></span><span><strong>Last edited</strong><small>{formatRelativeTime(document.updated_at)}</small></span></p>
                <p className="details-activity"><span><Icon name="check" size={14} /></span><span><strong>Persistence active</strong><small>Changes save automatically</small></span></p>
              </div>
              <button className="copy-link-button" type="button" onClick={copyDocumentLink}><Icon name={copied ? "check" : "link"} size={15} />{copied ? "Link copied" : "Copy document link"}</button>
            </aside>
          )}
        </div>
      </main>

      {shareOpen && (
        <div className="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-title">
          <button className="share-panel__backdrop" type="button" aria-label="Close sharing" onClick={() => setShareOpen(false)} />
          <aside className="share-drawer">
            <div className="share-drawer__top"><div><span className="section-kicker">Permissions</span><h2 id="share-title">Share document</h2></div><button className="icon-button" type="button" onClick={() => setShareOpen(false)} aria-label="Close"><Icon name="chevronRight" /></button></div>
            <p>Invite an existing DocuEdit user to collaborate on <strong>{document.title}</strong>.</p>
            <form className="share-form" onSubmit={handleAddMember}>
              <label><span>Email address</span><input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="teammate@company.dev" required /></label>
              <label><span>Permission</span><select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="editor">Can edit</option><option value="viewer">Can view</option></select></label>
              <button className="button button--primary button--full" type="submit"><Icon name="users" size={16} />Add member</button>
              {shareStatus && <p className={`form-message ${shareStatus.includes("successfully") ? "form-message--success" : shareStatus === "Sharing..." ? "" : "form-message--error"}`}>{shareStatus}</p>}
            </form>
            <div className="permission-guide"><h3>Permission guide</h3><div><span className="role-dot role-dot--editor" /><p><strong>Editor</strong><small>Can read and make live changes</small></p></div><div><span className="role-dot role-dot--viewer" /><p><strong>Viewer</strong><small>Can read, but cannot edit</small></p></div></div>
            <button className="copy-link-button" type="button" onClick={copyDocumentLink}><Icon name={copied ? "check" : "link"} size={15} />{copied ? "Link copied" : "Copy secure document link"}</button>
          </aside>
        </div>
      )}

      {membersOpen && (
        <div className="share-panel" role="dialog" aria-modal="true" aria-labelledby="members-title">
          <button className="share-panel__backdrop" type="button" aria-label="Close members" onClick={() => setMembersOpen(false)} />
          <aside className="share-drawer members-drawer">
            <div className="share-drawer__top"><div><span className="section-kicker">Document access</span><h2 id="members-title">Members</h2></div><button className="icon-button" type="button" onClick={() => setMembersOpen(false)} aria-label="Close"><Icon name="chevronRight" /></button></div>
            <p>{members.length} {members.length === 1 ? "person has" : "people have"} access. {presence.length} currently online.</p>
            {membersError && <p className="form-message form-message--error">{membersError}</p>}
            <div className="members-list">
              {membersLoading ? <p className="members-list__empty">Loading members…</p> : members.map((member) => {
                const online = presence.some((person) => person.id === member.id);
                return (
                  <div className="member-item" key={member.id}>
                    <span className={`member-item__avatar ${online ? "member-item__avatar--online" : ""}`}>{initials(member.email)}</span>
                    <p><strong>{member.email}</strong><small>{online ? "Online now" : member.role}</small></p>
                    {effectiveRole === "owner" && member.role !== "owner" ? (
                      <select value={member.role} disabled={updatingMemberId === member.id} onChange={(event) => handleRoleChange(member, event.target.value)} aria-label={`Permission for ${member.email}`}><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                    ) : <span className="member-item__role">{member.role}</span>}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </WorkspaceLayout>
  );
}
