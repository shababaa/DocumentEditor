import { Link } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import PublicHeader from "../components/PublicHeader.jsx";
import Icon from "../components/Icon.jsx";

const workflow = [
  { number: "01", icon: "vscode", label: "Inside VS Code", title: "Choose code worth explaining", text: "Run DocuEdit from the current file or a focused selection. File context and language come along for the ride." },
  { number: "02", icon: "sparkles", label: "Documentation draft", title: "Generate a useful first pass", text: "Your backend turns source into structured Markdown and creates a secure document in your workspace." },
  { number: "03", icon: "users", label: "Inside DocuEdit", title: "Make the details true together", text: "Open the draft in a focused editor, invite teammates, and refine it live without conflicting changes." },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing-page grid-backdrop">
      <PublicHeader />
      <main>
        <section className="hero section-wrap">
          <div className="hero__copy">
            <div className="eyebrow"><span className="eyebrow__dot" />The writing layer for your codebase</div>
            <h1>Documentation starts in code.<br /><span>It gets better together.</span></h1>
            <p className="hero__lede">Generate a thoughtful Markdown draft from any file in VS Code, then bring it into a calm collaborative workspace where your team can make it accurate.</p>
            <div className="hero__actions">
              <Link className="button button--primary" to={user ? "/documents" : "/signup"}>
                {user ? "Open your workspace" : "Create your workspace"}<Icon name="arrowRight" />
              </Link>
              <a className="button button--secondary" href="#workflow"><Icon name="vscode" />See how it works</a>
            </div>
            <div className="hero__trust">
              <span><Icon name="check" size={15} />Markdown-native</span>
              <span><Icon name="check" size={15} />CRDT collaboration</span>
              <span><Icon name="check" size={15} />Secrets stay server-side</span>
            </div>
          </div>

          <div className="product-scene" aria-label="DocuEdit product preview">
            <div className="product-scene__glow" />
            <div className="vscode-card">
              <div className="window-bar"><span /><span /><span /><em>handler.ts — api</em></div>
              <div className="code-preview">
                <div className="code-rail"><Icon name="fileCode" size={16} /><Icon name="search" size={16} /><Icon name="github" size={16} /></div>
                <pre><code><span className="code-muted">12</span> <span className="code-purple">export async function</span>{" "}<span className="code-blue">createHandler</span>(req) {"{"}{"\n"}<span className="code-muted">13</span>   <span className="code-purple">const</span> payload = <span className="code-purple">await</span> req.json();{"\n"}<span className="code-muted">14</span>   <span className="code-purple">return</span> documents.create(payload);{"\n"}<span className="code-muted">15</span> {"}"}</code></pre>
              </div>
              <div className="command-palette">
                <span><Icon name="chevronRight" size={15} /></span>
                <strong>DocuEdit: Generate Documentation from Current File</strong>
                <kbd>↵</kbd>
              </div>
            </div>
            <div className="editor-preview-card">
              <div className="editor-preview__bar">
                <span className="mini-brand"><Icon name="document" size={13} /></span>
                <strong>API handler</strong>
                <span className="save-pill"><span className="status-dot" />Saved</span>
                <div className="avatar-stack"><span>SK</span><span>AM</span><span>+2</span></div>
              </div>
              <article>
                <span className="generated-tag"><Icon name="sparkles" size={12} />Generated from handler.ts</span>
                <h2>Create document handler</h2>
                <p>Creates a new documentation record from a validated request payload.</p>
                <h3>Request flow</h3>
                <div className="preview-callout"><Icon name="code" /><span><strong>POST /documents</strong><small>Requires an authenticated workspace member</small></span></div>
                <p className="preview-lines"><span /><span /><span /></p>
              </article>
            </div>
          </div>
        </section>

        <section className="workflow section-wrap" id="workflow">
          <div className="section-heading">
            <div><span className="section-kicker">One continuous workflow</span><h2>From implementation detail<br />to shared understanding.</h2></div>
            <p>No copy-paste maze. Generate near the code, edit where writing feels natural, and keep collaboration connected to the document.</p>
          </div>
          <div className="workflow-grid">
            {workflow.map((step) => (
              <article className="workflow-card" key={step.number}>
                <span className="workflow-card__number">{step.number}</span>
                <span className="workflow-card__icon"><Icon name={step.icon} size={21} /></span>
                <small>{step.label}</small>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="collab-feature section-wrap" id="collaboration">
          <div className="collab-feature__visual">
            <div className="collab-doc">
              <div className="collab-doc__top"><span>Authentication guide.md</span><span className="save-pill"><span className="status-dot" />3 online</span></div>
              <div className="collab-doc__body">
                <h3>Session lifecycle</h3>
                <p>Sessions are stored in secure, HTTP-only cookies and validated before document access.</p>
                <p className="selected-copy">Editors can update content while viewers retain read-only access.<span className="cursor-label">Ari</span></p>
                <div className="comment-chip"><span>SK</span> Should we link the permission matrix here?</div>
              </div>
            </div>
          </div>
          <div className="collab-feature__copy">
            <span className="section-kicker">Collaboration without collision</span>
            <h2>Write at the same time. Keep every intention.</h2>
            <p>DocuEdit uses Yjs CRDT collaboration so simultaneous edits converge instead of replacing one another. Permissions keep the right people in the room.</p>
            <ul className="check-list">
              <li><Icon name="check" />Real-time document convergence</li>
              <li><Icon name="check" />Owner, editor, and viewer roles</li>
              <li><Icon name="check" />Automatic persistence and recovery</li>
            </ul>
          </div>
        </section>

        <section className="landing-cta section-wrap">
          <span className="landing-cta__icon"><Icon name="sparkles" size={24} /></span>
          <h2>Your code already has a story.<br />Give it a workspace.</h2>
          <p>Turn the next file you open into documentation your team can actually maintain.</p>
          <Link className="button button--primary" to={user ? "/documents" : "/signup"}>{user ? "Go to documents" : "Start with DocuEdit"}<Icon name="arrowRight" /></Link>
        </section>
      </main>
      <footer className="landing-footer section-wrap"><span>© 2026 DocuEdit</span><span>Built for codebases that deserve an explanation.</span></footer>
    </div>
  );
}
