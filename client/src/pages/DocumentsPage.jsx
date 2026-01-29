import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from "react-router-dom"


export default function DocumentsPage() {
    const [title, setTitle] = useState('')
    const [docs, setDocs] = useState([])
    const [documents, setDocuments] = useState()
    const navigate = useNavigate()
    const location = useLocation()
    useEffect(() => {
        getDocuments().then(setDocs)
    }, [location])

    async function createDocument(title) {
        const res = await fetch('http://localhost:5001/documents', {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({title, content: ""})
        })
        if (!res.ok) throw new Error("failed to create document")
        return res.json()
    }
    async function handleNewDoc(e) {
        e.preventDefault()
        if (!title.trim()) return
        await createDocument(title.trim())
        setTitle('')
        setDocs(await getDocuments())
    }

    async function getDocuments() {
        const res = await fetch('http://localhost:5001/documents', {
            method: "GET",
            headers: {"Content-Type":"application/json"}
        })
        if (!res.ok) throw new Error("failed to fetch documents")
        const data = await res.json()
        console.log(data)
        return data

    }

    return (
        <>
            <h1 className='bg- p-5 font-serif text-2xl justify-self-center rounded-2xl border-2
                '>Render docs here</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {docs.map((d)=>{
                return(
                <div className="card bg-base-100 shadow-sm ">
                    <figure>
                        <img
                        src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
                        alt="Shoes" />
                    </figure>
                    <div className="card-body">
                        <h2 className="card-title">{d.title}</h2>
                        <p>{d.updatedAt}</p>
                        <div className="card-actions justify-end">
                        <button className="btn btn-primary" onClick={() => navigate(`/doc/${d.id}`, {title: d.title, content:d.content, updatedAt:d.updatedAt})}>Open</button>
                        </div>
                    </div>
                </div>
                )
            })}
            </div>
                <form onSubmit={handleNewDoc}>
                    <input placeholder="enter title" type= "text" value={title} onChange={(e) => setTitle(e.target.value)}/>
                    <button className='btn w-64 rounded-full'>BUTTON</button>
                </form>
        </>
    )
}