import { useState } from 'react'
import { useNavigate } from "react-router-dom"
import { useDocuments } from "../hooks/useDocuments"
import { useAuth } from "../auth/authContext.js"


export default function DocumentsPage() {

    const {
        documents,
        loading,
        error,
        createDoc,
        creating,
        createError,
    } = useDocuments();

    const [title, setTitle] = useState("")
    const navigate = useNavigate()
    const { user, logout } = useAuth()

    async function handleLogout() {
        await logout()
        navigate("/login", { replace: true })
    }
    
    async function handleCreateDocument(e) {
        e.preventDefault();
        
        const doc = await createDoc(title);
        if(!doc) return;
        
        setTitle("")
        navigate(`/doc/${doc.id}`)
    }

    if (loading) return <h1>Loading documents...</h1>

    return (
        <div>
            <h1>My Documents</h1>
            <p>{user.email}</p>
            <button type="button" onClick={handleLogout}>Log out</button>

            {error && <p>{error}</p>}

            <form onSubmit={handleCreateDocument}>
                <input 
                    value={title}
                    onChange= {(e) => setTitle(e.target.value)}
                    placeholder="Document title"
                />
                
                <button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Document"}
                </button>
            </form>

            {createError && <p>{createError}</p>}
            <div>
                {documents.map((doc) => (
                <div key={doc.id}>
                    <h2 onClick={() => navigate(`/doc/${doc.id}`)}>
                    {doc.title}
                    </h2>
                </div>
                ))}
            </div>
        </div>
    )
}
