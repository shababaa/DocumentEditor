import { NavLink, useNavigate } from "react-router-dom";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";

function initials(email = "") {
  return email.slice(0, 2).toUpperCase() || "DE";
}

export default function AppSidebar({ collapsed, onToggle, user, onLogout, recentDocuments = [] }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await onLogout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""}`}>
      <div className="sidebar__top">
        <Brand compact={collapsed} to="/documents" />
        <button className="icon-button sidebar__toggle" type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevronRight" : "panel"} size={17} />
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Workspace navigation">
        <p className="sidebar__eyebrow">Workspace</p>
        <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`} to="/documents">
          <Icon name="dashboard" />
          <span>Documents</span>
        </NavLink>
        <a className="sidebar-link" href="/#workflow">
          <Icon name="vscode" />
          <span>VS Code flow</span>
        </a>
      </nav>

      {!collapsed && recentDocuments.length > 0 && (
        <div className="sidebar__recent">
          <p className="sidebar__eyebrow">Recent</p>
          {recentDocuments.slice(0, 4).map((doc) => (
            <NavLink className="sidebar-recent" key={doc.id} to={`/doc/${doc.id}`} title={doc.title}>
              <Icon name="document" size={15} />
              <span>{doc.title}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="sidebar__spacer" />
      <div className="sidebar__status">
        <span className="status-dot" />
        <span>Collaboration ready</span>
      </div>
      <div className="sidebar__account">
        <div className="avatar avatar--user">{initials(user?.email)}</div>
        {!collapsed && (
          <div className="sidebar__account-copy">
            <strong>{user?.email?.split("@")[0]}</strong>
            <span>{user?.email}</span>
          </div>
        )}
        <button className="icon-button" type="button" onClick={handleLogout} aria-label="Log out" title="Log out">
          <Icon name="logout" size={17} />
        </button>
      </div>
    </aside>
  );
}
