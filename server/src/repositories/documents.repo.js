import { pool } from "../db/pool.js"

export async function listDocuments(){
  const [rows] = await pool.query(
    `SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC`
  );
  return rows
}

export async function getDocumentById(id){
  const [rows] = await pool.query(
    `
    SELECT id, 
      title, 
      content, 
      created_at, 
      updated_at 
    FROM documents 
    WHERE id = ?
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function insertDocument({ id, title, content }){
  await pool.query(
    `INSERT INTO documents (id, title, content) VALUES (?, ?, ?)`,
    [id, title, content]
  );

  return getDocumentById(id)
}

export async function updateDocumentContent(id, content) {
  const [result] = await pool.query(
    "UPDATE documents SET content = ? WHERE id = ?",
    [content, id]
  );

  if (result.affectedRows === 0) return null // not found
  return getDocumentById(id);
}