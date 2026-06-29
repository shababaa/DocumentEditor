import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import AuthShell from "../components/AuthShell.jsx";
import Icon from "../components/Icon.jsx";

export default function Register() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
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
      await signup(email, password);
      navigate("/documents", { replace: true });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell mode="signup">
      <div className="auth-card">
        <div className="auth-card__heading">
          <span className="auth-card__icon"><Icon name="sparkles" /></span>
          <h2>Create your workspace</h2>
          <p>Start turning implementation details into living documentation.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.dev" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required />
          </label>
          {error && <p className="form-message form-message--error" role="alert">{error}</p>}
          <button className="button button--primary button--full" type="submit" disabled={submitting}>
            {submitting ? "Creating workspace..." : "Create account"}<Icon name="arrowRight" size={16} />
          </button>
        </form>
        <p className="auth-card__switch">Already have an account? <Link to="/login">Log in</Link></p>
        <p className="auth-card__fineprint"><Icon name="check" size={14} />No API key is ever stored in the extension.</p>
      </div>
    </AuthShell>
  );
}
