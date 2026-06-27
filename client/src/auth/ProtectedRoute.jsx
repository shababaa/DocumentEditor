import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext.js";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <h1>Checking session...</h1>;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
