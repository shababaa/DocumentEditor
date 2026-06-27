import { getAuthContext } from "../services/auth.service.js";

export async function authenticateRequest(req) {
  return getAuthContext(req);
}

export async function requireAuth(req, res, next) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    req.user = auth.user;
    req.sessionTokenHash = auth.tokenHash;
    return next();
  } catch (error) {
    return next(error);
  }
}
