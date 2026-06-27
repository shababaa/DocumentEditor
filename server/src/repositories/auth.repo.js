import { pool } from "../db/pool.js";

let authSchemaPromise = null;

export function ensureAuthSchema() {
  if (!authSchemaPromise) {
    authSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id CHAR(36) NOT NULL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash CHAR(64) NOT NULL PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sessions_user_id (user_id),
          INDEX idx_sessions_expires_at (expires_at),
          CONSTRAINT fk_sessions_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      const [ownerColumns] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'documents'
          AND COLUMN_NAME = 'owner_user_id'
      `);
      if (ownerColumns.length === 0) {
        await pool.query(`
          ALTER TABLE documents
          ADD COLUMN owner_user_id CHAR(36) NULL,
          ADD INDEX idx_documents_owner_user_id (owner_user_id)
        `);
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS document_members (
          document_id VARCHAR(36) NOT NULL,
          user_id CHAR(36) NOT NULL,
          role ENUM('owner', 'editor', 'viewer') NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (document_id, user_id),
          INDEX idx_document_members_user_id (user_id),
          CONSTRAINT fk_document_members_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    })().catch((error) => {
      authSchemaPromise = null;
      throw error;
    });
  }

  return authSchemaPromise;
}

export async function findUserByEmail(email) {
  await ensureAuthSchema();
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, created_at, updated_at
     FROM users WHERE email = ?`,
    [email]
  );
  return rows[0] ?? null;
}

export async function createUserWithLegacyOwnership({ id, email, passwordHash }) {
  await ensureAuthSchema();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [id, email, passwordHash]
    );

    const [[{ user_count: userCount }]] = await connection.query(
      "SELECT COUNT(*) AS user_count FROM users"
    );
    if (Number(userCount) === 1) {
      await connection.query(
        "UPDATE documents SET owner_user_id = ? WHERE owner_user_id IS NULL",
        [id]
      );
      await connection.query(
        `INSERT IGNORE INTO document_members (document_id, user_id, role)
         SELECT id, ?, 'owner' FROM documents WHERE owner_user_id = ?`,
        [id, id]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return findUserByEmail(email);
}

export async function insertSession({ tokenHash, userId, expiresAt }) {
  await ensureAuthSchema();
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash, userId, expiresAt]
  );
}

export async function findUserBySessionTokenHash(tokenHash) {
  await ensureAuthSchema();
  const [rows] = await pool.query(
    `
      SELECT u.id, u.email, u.created_at, u.updated_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
    `,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function deleteSession(tokenHash) {
  await ensureAuthSchema();
  await pool.query("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

export async function deleteExpiredSessions() {
  await ensureAuthSchema();
  await pool.query("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP");
}
