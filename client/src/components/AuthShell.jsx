import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";

const steps = [
  ["vscode", "Generate in VS Code", "Turn the current file or selection into a documentation draft."],
  ["document", "Land in DocuEdit", "Every generated draft becomes a durable, editable document."],
  ["users", "Refine together", "Collaborate live without edits overwriting one another."],
];

export default function AuthShell({ mode, children }) {
  return (
    <main className="auth-page grid-backdrop">
      <div className="auth-topbar"><Brand /><Link to="/">Back to home</Link></div>
      <section className="auth-story">
        <div className="eyebrow"><span className="eyebrow__dot" />Documentation that keeps up with code</div>
        <h1>{mode === "login" ? "Pick up where your code left off." : "Give your codebase a place to explain itself."}</h1>
        <p>Generate structured docs from inside VS Code, then shape the details with your team in a focused writing workspace.</p>
        <div className="auth-flow">
          {steps.map(([icon, title, description], index) => (
            <div className="auth-flow__step" key={title}>
              <span className="auth-flow__number">0{index + 1}</span>
              <span className="auth-flow__icon"><Icon name={icon} /></span>
              <div><strong>{title}</strong><p>{description}</p></div>
            </div>
          ))}
        </div>
      </section>
      <section className="auth-card-wrap">{children}</section>
    </main>
  );
}
