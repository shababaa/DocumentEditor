import { useState } from "react";
import { useAuth } from "../auth/authContext.js";
import AppSidebar from "./AppSidebar.jsx";

export default function WorkspaceLayout({ children, recentDocuments = [], className = "" }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("docuedit-sidebar") === "collapsed");

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("docuedit-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <div className={`workspace-shell ${collapsed ? "workspace-shell--collapsed" : ""} ${className}`}>
      <AppSidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        user={user}
        onLogout={logout}
        recentDocuments={recentDocuments}
      />
      <div className="workspace-content">{children}</div>
    </div>
  );
}
