import { pool } from "../db/pool.js"

let yjsStateTablePromise = null;
let yjsStateTableReady = false;

export function ensureYjsStateTable() {
  if (!yjsStateTablePromise) {
    yjsStateTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS document_yjs_states (
        document_id VARCHAR(36) NOT NULL PRIMARY KEY,
        state LONGBLOB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `).then(() => {
      yjsStateTableReady = true;
    }).catch((error) => {
      yjsStateTablePromise = null;
      throw error;
    });
  }

  return yjsStateTablePromise;
}

export async function listDocuments(userId){
  const [rows] = await pool.query(
    `
      SELECT d.id, d.title, d.updated_at, dm.role
      FROM documents d
      JOIN document_members dm ON dm.document_id = d.id
      WHERE dm.user_id = ?
      ORDER BY d.updated_at DESC
    `,
    [userId]
  );
  return rows
}

export async function getDocumentById(id){
  const [rows] = await pool.query(
    `
    SELECT id, 
      title, 
      content, 
      owner_user_id,
      created_at, 
      updated_at 
    FROM documents 
    WHERE id = ?
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function getDocumentForUser(id, userId) {
  const [rows] = await pool.query(
    `
      SELECT d.id, d.title, d.content, d.owner_user_id,
        d.created_at, d.updated_at, dm.role
      FROM documents d
      JOIN document_members dm ON dm.document_id = d.id
      WHERE d.id = ? AND dm.user_id = ?
    `,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function getDocumentRole(id, userId) {
  const [rows] = await pool.query(
    "SELECT role FROM document_members WHERE document_id = ? AND user_id = ?",
    [id, userId]
  );
  return rows[0]?.role ?? null;
}

export async function insertDocument({ id, title, content, ownerUserId }){
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO documents (id, title, content, owner_user_id) VALUES (?, ?, ?, ?)`,
      [id, title, content, ownerUserId]
    );
    await connection.query(
      `INSERT INTO document_members (document_id, user_id, role) VALUES (?, ?, 'owner')`,
      [id, ownerUserId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getDocumentForUser(id, ownerUserId)
}

export async function updateDocumentContent(id, content, userId) {
  if (yjsStateTableReady) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [members] = await connection.query(
        `SELECT role FROM document_members
         WHERE document_id = ? AND user_id = ? FOR UPDATE`,
        [id, userId]
      );
      if (!members[0] || !["owner", "editor"].includes(members[0].role)) {
        await connection.rollback();
        return null;
      }
      await connection.query(
        "UPDATE documents SET content = ? WHERE id = ?",
        [content, id]
      );

      // A direct REST write starts a new CRDT history the next time the room loads.
      await connection.query(
        "DELETE FROM document_yjs_states WHERE document_id = ?",
        [id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return getDocumentForUser(id, userId);
  }

  const role = await getDocumentRole(id, userId);
  if (!role || !["owner", "editor"].includes(role)) return null;

  const [result] = await pool.query(
    "UPDATE documents SET content = ? WHERE id = ?",
    [content, id]
  );

  if (result.affectedRows === 0) return null // not found
  return getDocumentForUser(id, userId);
}

export async function listDocumentMembers(documentId) {
  const [rows] = await pool.query(
    `
      SELECT u.id, u.email, dm.role, dm.created_at
      FROM document_members dm
      JOIN users u ON u.id = dm.user_id
      WHERE dm.document_id = ?
      ORDER BY FIELD(dm.role, 'owner', 'editor', 'viewer'), u.email
    `,
    [documentId]
  );
  return rows;
}

export async function addDocumentMember({ documentId, ownerUserId, email, role }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [owners] = await connection.query(
      `SELECT role FROM document_members
       WHERE document_id = ? AND user_id = ? FOR UPDATE`,
      [documentId, ownerUserId]
    );
    if (owners[0]?.role !== "owner") {
      await connection.rollback();
      return { status: "forbidden" };
    }

    const [users] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (!users[0]) {
      await connection.rollback();
      return { status: "user-not-found" };
    }

    await connection.query(
      `
        INSERT INTO document_members (document_id, user_id, role)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role = IF(role = 'owner', 'owner', VALUES(role))
      `,
      [documentId, users[0].id, role]
    );
    await connection.commit();
    return { status: "ok" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateDocumentMemberRole({ documentId, ownerUserId, memberUserId, role }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [owners] = await connection.query(
      "SELECT role FROM document_members WHERE document_id = ? AND user_id = ? FOR UPDATE",
      [documentId, ownerUserId]
    );
    if (owners[0]?.role !== "owner") {
      await connection.rollback();
      return { status: "forbidden" };
    }

    const [members] = await connection.query(
      "SELECT role FROM document_members WHERE document_id = ? AND user_id = ? FOR UPDATE",
      [documentId, memberUserId]
    );
    if (!members[0]) {
      await connection.rollback();
      return { status: "not-found" };
    }
    if (members[0].role === "owner") {
      await connection.rollback();
      return { status: "owner-immutable" };
    }

    await connection.query(
      "UPDATE document_members SET role = ? WHERE document_id = ? AND user_id = ?",
      [role, documentId, memberUserId]
    );
    await connection.commit();
    return { status: "ok" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getDocumentYjsState(id) {
  await ensureYjsStateTable();
  const [rows] = await pool.query(
    "SELECT state FROM document_yjs_states WHERE document_id = ?",
    [id]
  );

  return rows[0]?.state ?? null;
}

export async function saveDocumentYjsState({ id, content, state }) {
  await ensureYjsStateTable();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE documents SET content = ? WHERE id = ?",
      [content, id]
    );

    if (result.affectedRows === 0) {
      const [documents] = await connection.query(
        "SELECT id FROM documents WHERE id = ?",
        [id]
      );
      if (!documents[0]) {
        throw new Error(`Cannot save Yjs state for missing document ${id}`);
      }
    }

    await connection.query(
      `
        INSERT INTO document_yjs_states (document_id, state)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE state = VALUES(state)
      `,
      [id, Buffer.from(state)]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
