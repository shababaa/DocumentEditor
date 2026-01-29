import { useParams } from "react-router-dom";
import { useState, useEffect } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { markdown } from "@codemirror/lang-markdown"

import { nord } from '@uiw/codemirror-theme-nord'

export default function EditorPage() {

    // const API = import.meta.env.VITE_API_BASE || "http://localhost:5000"
    
    const [document, setDocument] = useState(null)
    const [content, setContent] = useState("")

    const {id} = useParams()

    useEffect(() => {
        async function getContent() {
            const res = await fetch(`http://localhost:5000/documents/${id}`, {
            method: "GET",
            headers: {"Content-Type":"application/json"},
            credentials: "include"
        })
        if (!res.ok) throw new Error(res.error)
        return res.json()
    }
        getContent().then((data)=>{
            setDocument(data)
            setContent(data.content ?? "")
        }).catch((err)=>console.error(err))
    }, [id])
    


    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!document) return
            const res = await fetch(`http://localhost:5000/documents/${id}`, {
                method: "PUT",
                headers: {"Content-Type":"application/json"},
                credentials: "include",
                body: JSON.stringify({content})
            })
            if (!res.ok) throw new Error("save failed")
        }, 1000) // Wait 1 second after user stops typing
        
        return () => clearTimeout(timer) // Cleanup timer if content changes again
    }, [content, id])
    
    function saveToContent(e) {
        e.preventDefault()
        // Content is auto-saved by the useEffect above
    }
    
    if (!document) return <h1>Loading...</h1>
    
    return (
        <div className="">
            <header className="title">{document.title}</header>
            <form>
                <CodeMirror 
                    value={content}
                    extensions={[markdown()]}
                    height="calc(100vh - 160px)"
                    onChange={(value) => setContent(value)}
                    basicSetup={{
                        lineNumbers: true,
                        highlightActiveLine: true,
                        foldGutter: true,
                    }}
                    theme={nord}
                    align="left"
                />
                <button className="btn btn-primary bg-black" type= "submit" onClick={saveToContent}>Save</button>
            </form>
            
        </div>
    )
}