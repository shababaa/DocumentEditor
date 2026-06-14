export async function getDocuments() {
    const [rows] = await pool.query("SELECT * FROM documents")
    return rows
}

export async function getDocument(id) {
    const [rows] = await pool.query(
        `SELECT * FROM documents
        WHERE id = ?`, [id]
    )
    return rows[0]
}

export async function createDocument(id, title, content){
    const [result] = await pool.query(
        "INSERT INTO documents (id, title, content) VALUES(?, ?, ?)",
        [id, title, content])
    return result
}

export async function updateDocument(id, content){
    const [result] = await pool.query(
        `UPDATE documents 
        SET content = ?
        WHERE id = ?`,
        [content, id]
    )
    return result
}

