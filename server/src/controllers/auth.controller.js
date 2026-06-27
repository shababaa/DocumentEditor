import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { config } from "../config.js";
import {
  createUserWithLegacyOwnership,
  findUserByEmail,
} from "../repositories/auth.repo.js";
import {
  createSession,
  revokeRequestSession,
  sessionCookieOptions,
} from "../services/auth.service.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dummyPasswordHash = bcrypt.hash("not-a-real-user-password", config.BCRYPT_ROUNDS);

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function validateCredentials(email, password) {
  if (
    typeof email !== "string"
    || email.trim().length > 255
    || !EMAIL_PATTERN.test(email.trim())
  ) {
    return "A valid email is required";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password must be ${MAX_PASSWORD_BYTES} UTF-8 bytes or fewer`;
  }
  return null;
}

async function setSessionCookie(res, userId) {
  const { token, expiresAt } = await createSession(userId);
  res.cookie(config.SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions,
    expires: expiresAt,
  });
}

export async function handleSignup(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    const validationError = validateCredentials(email, password);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
    const user = await createUserWithLegacyOwnership({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
    });
    await revokeRequestSession(req);
    await setSessionCookie(res, user.id);
    return res.status(201).json({ ok: true, user: publicUser(user) });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, error: "Email is already registered" });
    }
    return next(error);
  }
}

export async function handleLogin(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    if (
      typeof email !== "string"
      || typeof password !== "string"
      || email.trim().length > 255
      || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
    ) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const user = await findUserByEmail(email.trim().toLowerCase());
    const passwordMatches = await bcrypt.compare(
      password,
      user?.password_hash || await dummyPasswordHash
    );
    if (!user || !passwordMatches) {
      return res.status(401).json({ ok: false, error: "Invalid email or password" });
    }

    await revokeRequestSession(req);
    await setSessionCookie(res, user.id);
    return res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function handleLogout(req, res, next) {
  try {
    await revokeRequestSession(req);
    res.clearCookie(config.SESSION_COOKIE_NAME, sessionCookieOptions);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export function handleMe(req, res) {
  return res.json({ ok: true, user: publicUser(req.user) });
}
