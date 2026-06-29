import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import DocumentsPage from "./pages/DocumentsPage";
import EditorPage from "./pages/EditorPage";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import LandingPage from "./pages/LandingPage.jsx";

function protectedPage(page) {
  return <ProtectedRoute>{page}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Register />} />
      <Route path="/documents" element={protectedPage(<DocumentsPage />)} />
      <Route path="/doc/:id" element={protectedPage(<EditorPage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
