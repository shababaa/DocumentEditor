import { Link } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";

export default function PublicHeader() {
  const { user } = useAuth();

  return (
    <header className="public-header">
      <Brand />
      <nav className="public-nav" aria-label="Primary navigation">
        <a href="/#workflow">Workflow</a>
        <a href="/#collaboration">Collaboration</a>
      </nav>
      <div className="public-actions">
        {user ? (
          <Link className="button button--primary button--small" to="/documents">Open workspace <Icon name="arrowRight" size={15} /></Link>
        ) : (
          <>
            <Link className="button button--ghost button--small" to="/login">Log in</Link>
            <Link className="button button--primary button--small" to="/signup">Start writing <Icon name="arrowRight" size={15} /></Link>
          </>
        )}
      </div>
    </header>
  );
}
