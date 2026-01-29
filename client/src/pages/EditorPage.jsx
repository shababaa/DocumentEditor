import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { markdown } from "@codemirror/lang-markdown"

import { nord } from '@uiw/codemirror-theme-nord'

export default function EditorPage() {

    const API = import.meta.env.VITE_API_BASE || "http://localhost:5001"
    
    const {id} = useParams()
    
    const [document, setDocument] = useState(null)
    const [content, setContent] = useState("")

    const wsRef = useRef(null)
    const clientIdRef = useRef(crypto.randomUUID())
    const ignoreNextSendRef = useRef(false)

    // receiving updates from other clients
    useEffect(() => {
        if (!id) return

        const wsUrl = `ws://localhost:5001/ws?docId=${id}&clientId=${clientIdRef.current}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        
        ws.onopen = () => {
            console.log("WebSocket connection established")
        }
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data)
            if (msg.clientId === clientIdRef.current) return
            ignoreNextSendRef.current = true
            setContent(msg.content)
            console.log("received message:", msg)
        }
        ws.onclose = (e) => {
            console.log("WebSocket connection closed", e.code, e.reason)
        }

        return () => {
            ws.close()
        }
    }, [id])

    // sending updates to other clients
    useEffect(() => {
        if (!id) return
        const ws = wsRef.current
        if (!ws) return
        if (ws.readyState !== 1) return // 1 is open

        if (ignoreNextSendRef.current) {
            ignoreNextSendRef.current = false
            return
        }

        const timer = setTimeout(() => {
            const msgObj = {
                type: "doc:update",
                docId: id,
                clientId: clientIdRef.current,
                content,
            }
            ws.send(JSON.stringify(msgObj))
            console.log("sent message:", msgObj)
        }, 300)

        return () => clearTimeout(timer)
        
    }, [content, id])


    useEffect(() => {
        async function getContent() {
            const res = await fetch(`http://localhost:5001/documents/${id}`, {
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
            const res = await fetch(`http://localhost:5001/documents/${id}`, {
                method: "PUT",
                headers: {"Content-Type":"application/json"},
                credentials: "include",
                body: JSON.stringify({content})
            })
            if (!res.ok) throw new Error("save failed")
        }, 1000) // Wait 1 second after user stops typing
        
        return () => clearTimeout(timer) // Cleanup timer if content changes again
    }, [content, id, document])
    
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