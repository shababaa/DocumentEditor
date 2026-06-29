import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext.js";
import Brand from "../components/Brand.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <main className="session-loader grid-backdrop"><Brand /><span className="loader-ring" /><h1>Opening your workspace</h1><p>Checking your DocuEdit session…</p></main>;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
