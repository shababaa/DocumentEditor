import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import AuthShell from "../components/AuthShell.jsx";
import Icon from "../components/Icon.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/documents" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from || "/documents", { replace: true });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell mode="login">
      <div className="auth-card">
        <div className="auth-card__heading">
          <span className="auth-card__icon"><Icon name="terminal" /></span>
          <h2>Welcome back</h2>
          <p>Sign in to continue to your documentation workspace.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.dev" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Your password" required />
          </label>
          {error && <p className="form-message form-message--error" role="alert">{error}</p>}
          <button className="button button--primary button--full" type="submit" disabled={submitting}>
            {submitting ? "Opening workspace..." : "Log in to DocuEdit"}<Icon name="arrowRight" size={16} />
          </button>
        </form>
        <p className="auth-card__switch">New to DocuEdit? <Link to="/signup">Create an account</Link></p>
        <p className="auth-card__fineprint"><Icon name="check" size={14} />Your session uses a secure HTTP-only cookie.</p>
      </div>
    </AuthShell>
  );
}
