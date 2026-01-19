const INITIAL_DOCS = [
    {id: "doc-1", title: "Interview Prep Notes", updatedAt: "2026-01-07T15:00:00Z", content: "Software Engineering Interview blah blah blah" },
    {id: "doc-2", title: "System Design Ideas", updatedAt: "2026-01-06T21:30:00Z", content: "System Design blah blah blah" },
    {id: "doc-3", title: "Collaborative Editor MVP", updatedAt: "2026-01-05T12:10:00Z", content: "MVP blah blah blah" },
]

// Load docs from localStorage or use defaults
function loadDocs() {
    const stored = localStorage.getItem("FAKE_DOCS")
    return stored ? JSON.parse(stored) : INITIAL_DOCS
}

export let FAKE_DOCS = loadDocs()

// Save docs to localStorage whenever they change
function saveDocs() {
    localStorage.setItem("FAKE_DOCS", JSON.stringify(FAKE_DOCS))
}


// export async function createDocument(title) {
//     const id = `doc-${Math.random().toString(16).slice(2)}`
//     const newDoc = {id, title, updatedAt: new Date().toISOString() }
//     FAKE_DOCS.unshift(newDoc) // NOTE: works for now in-memory
//     saveDocs()
//     return newDoc
// }