import { createHash, randomBytes } from "node:crypto";

import { config } from "../config.js";
import {
  deleteSession,
  findUserBySessionTokenHash,
  insertSession,
} from "../repositories/auth.repo.js";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
};

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(req) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) continue;
    const name = part.slice(0, separatorIndex).trim();
    if (name === config.SESSION_COOKIE_NAME) {
      return part.slice(separatorIndex + 1).trim();
    }
  }
  return null;
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000
  );
  await insertSession({ tokenHash, userId, expiresAt });
  return { token, expiresAt };
}

export async function getAuthContext(req) {
  const token = readSessionToken(req);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const user = await findUserBySessionTokenHash(tokenHash);
  return user ? { user, tokenHash } : null;
}

export async function revokeRequestSession(req) {
  const token = readSessionToken(req);
  if (token) await deleteSession(hashSessionToken(token));
}
