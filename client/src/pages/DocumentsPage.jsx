import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";
import WorkspaceLayout from "../components/WorkspaceLayout.jsx";
import Icon from "../components/Icon.jsx";
import { documentMeta, documentPreview, formatRelativeTime } from "../utils/documentPresentation.js";

function DocumentCard({ document, onOpen, onShare }) {
  const meta = documentMeta(document);
  return (
    <article className="document-card" onClick={onOpen}>
      <div className="document-card__top">
        <span className={`file-glyph ${meta.generated ? "file-glyph--generated" : ""}`}><Icon name={meta.generated ? "fileCode" : "document"} size={20} /></span>
        <div className="document-card__badges">
          {meta.generated && <span className="badge badge--generated"><Icon name="sparkles" size={11} />Generated</span>}
          <span className="badge">{document.role}</span>
        </div>
      </div>
      <div className="document-card__body">
        <h3>{document.title}</h3>
        <p>{documentPreview(document)}</p>
      </div>
      <div className="document-card__source">
        <span><Icon name="code" size={14} />{meta.source}</span>
        <span className="language-pill">{meta.language}</span>
      </div>
      <footer className="document-card__footer">
        <span><Icon name="clock" size={14} />Edited {formatRelativeTime(document.updated_at)}</span>
        <div className="document-card__people" aria-label="Live collaboration available">
          <div className="avatar-stack avatar-stack--small"><span>Y</span><span>+</span></div>
          <span>Live sync</span>
        </div>
        <button className="icon-button" type="button" title="Share document" aria-label={`Share ${document.title}`} onClick={(event) => { event.stopPropagation(); onShare(); }}>
          <Icon name="share" size={16} />
        </button>
      </footer>
    </article>
  );
}

function CreatePanel({ title, setTitle, creating, error, onSubmit, onClose }) {
  return (
    <div className="create-panel" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
      <button className="create-panel__backdrop" type="button" aria-label="Close" onClick={onClose} />
      <form className="create-dialog" onSubmit={onSubmit}>
        <div className="create-dialog__icon"><Icon name="document" size={22} /></div>
        <div><span className="section-kicker">New document</span><h2 id="new-document-title">Start with a blank page</h2><p>Create a Markdown document now, or generate one from code inside VS Code.</p></div>
        <label><span>Document title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Authentication architecture" /></label>
        {error && <p className="form-message form-message--error">{error}</p>}
        <div className="create-dialog__actions"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="submit" disabled={creating}>{creating ? "Creating..." : "Create document"}<Icon name="arrowRight" size={16} /></button></div>
      </form>
    </div>
  );
}

export default function DocumentsPage() {
  const { documents, loading, error, createDoc, creating, createError } = useDocuments();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const matchesQuery = document.title.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "generated" && documentMeta(document).generated) || document.role === filter;
    return matchesQuery && matchesFilter;
  }), [documents, query, filter]);

  const generatedCount = useMemo(() => documents.filter((document) => documentMeta(document).generated).length, [documents]);

  async function handleCreateDocument(event) {
    event.preventDefault();
    const document = await createDoc(title);
    if (!document) return;
    setTitle("");
    setShowCreate(false);
    navigate(`/doc/${document.id}`);
  }

  function openShare(document) {
    navigate(`/doc/${document.id}`, { state: { openShare: true } });
  }

  return (
    <WorkspaceLayout recentDocuments={documents} className="dashboard-shell">
      <main className="dashboard grid-backdrop">
        <header className="dashboard-header">
          <div><span className="section-kicker">Documentation workspace</span><h1>Good morning. What are we documenting?</h1><p>Turn implementation details into clear, collaborative knowledge.</p></div>
          <button className="button button--primary" type="button" onClick={() => setShowCreate(true)}><Icon name="plus" />New document</button>
        </header>

        <section className="command-center">
          <div className="command-search"><Icon name="search" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents, source files, or languages..." aria-label="Search documents" /><kbd>⌘ K</kbd></div>
          <div className="quick-actions">
            <button type="button" onClick={() => setShowCreate(true)}><span><Icon name="plus" /></span><strong>Blank document</strong><small>Start writing in Markdown</small><Icon name="arrowRight" size={15} /></button>
            <a href="/#workflow"><span className="quick-action--vscode"><Icon name="vscode" /></span><strong>Generate from code</strong><small>Run the command in VS Code</small><Icon name="external" size={15} /></a>
          </div>
        </section>

        <section className="dashboard-stats" aria-label="Workspace summary">
          <div><span className="stat-icon"><Icon name="document" /></span><p><strong>{documents.length}</strong><span>Total documents</span></p></div>
          <div><span className="stat-icon stat-icon--purple"><Icon name="sparkles" /></span><p><strong>{generatedCount}</strong><span>Generated from code</span></p></div>
          <div><span className="stat-icon stat-icon--green"><Icon name="activity" /></span><p><strong>Ready</strong><span>Live collaboration</span></p></div>
        </section>

        <section className="document-section">
          <div className="section-toolbar">
            <div><h2>Your documents</h2><span>{filteredDocuments.length} {filteredDocuments.length === 1 ? "document" : "documents"}</span></div>
            <div className="filter-tabs" role="group" aria-label="Filter documents">
              {[['all', 'All'], ['generated', 'Generated'], ['owner', 'Owned'], ['editor', 'Shared']].map(([value, label]) => <button className={filter === value ? "active" : ""} type="button" key={value} onClick={() => setFilter(value)}>{label}</button>)}
            </div>
          </div>

          {error && <div className="inline-notice inline-notice--error"><Icon name="activity" />{error}</div>}
          {loading ? (
            <div className="document-grid">{[1, 2, 3].map((item) => <div className="document-card document-card--skeleton" key={item}><span /><span /><span /></div>)}</div>
          ) : filteredDocuments.length > 0 ? (
            <div className="document-grid">{filteredDocuments.map((document) => <DocumentCard key={document.id} document={document} onOpen={() => navigate(`/doc/${document.id}`)} onShare={() => openShare(document)} />)}</div>
          ) : (
            <div className="empty-state"><span className="empty-state__icon"><Icon name={documents.length ? "search" : "fileCode"} size={28} /></span><h3>{documents.length ? "No documents match that search" : "Your documentation workspace is ready"}</h3><p>{documents.length ? "Try another keyword or reset the filters." : "Create a blank Markdown document here, or generate your first draft from an active file in VS Code."}</p><button className="button button--primary" type="button" onClick={() => documents.length ? (setQuery(""), setFilter("all")) : setShowCreate(true)}>{documents.length ? "Clear filters" : "Create first document"}<Icon name="arrowRight" size={16} /></button></div>
          )}
        </section>

        <div className="dashboard-lower">
          <section className="onboarding-card">
            <div className="onboarding-card__heading"><span><Icon name="vscode" /></span><div><small>Developer workflow</small><h2>From code to shared docs</h2></div><a href="/#workflow">View guide <Icon name="arrowRight" size={14} /></a></div>
            <div className="onboarding-flow">
              <div><strong>1</strong><p><b>Open a source file</b><span>Select a function, class, or use the entire active file.</span></p></div>
              <i />
              <div><strong>2</strong><p><b>Run DocuEdit</b><span>Choose “Generate Documentation from Current File”.</span></p></div>
              <i />
              <div><strong>3</strong><p><b>Refine together</b><span>The generated document opens here, ready to edit.</span></p></div>
            </div>
          </section>

          <section className="history-card">
            <div className="history-card__heading"><div><span className="section-kicker">Workspace activity</span><h2>Recent history</h2></div><Icon name="clock" /></div>
            {documents.length ? <div className="timeline">{documents.slice(0, 4).map((document) => { const meta = documentMeta(document); return <button type="button" key={document.id} onClick={() => navigate(`/doc/${document.id}`)}><span className={`timeline__dot ${meta.generated ? "timeline__dot--generated" : ""}`} /><p><strong>{meta.generated ? "Generated from code" : "Document updated"}</strong><span>{document.title}</span></p><time>{formatRelativeTime(document.updated_at)}</time></button>; })}</div> : <p className="history-empty">Activity will appear as you create and update documents.</p>}
          </section>
        </div>
      </main>
      {showCreate && <CreatePanel title={title} setTitle={setTitle} creating={creating} error={createError} onSubmit={handleCreateDocument} onClose={() => setShowCreate(false)} />}
    </WorkspaceLayout>
  );
}
