import express from "express"
import cors from "cors"
import { getDocuments, getDocument, createDocument, updateDocument } from "./database.js"
import { v4 as uuidv4 } from "uuid"
import "dotenv/config"
import { WebSocketServer } from "ws"

const app = express()


app.use(express.json())
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true
    })
)

app.get("/health", (req, res) => {
    res.json({ok: true, message: "server is healthy"})
})

app.get("/documents", async (req, res) => {
    const documents = await getDocuments()
    res.json(documents)
})

app.get("/documents/id", async (req, res) => {
    const id = await getId()

})

app.get("/documents/:id", async (req, res) => {
    const {id} = req.params
    const data = await getDocument(id)
    if (!data) res.status(404).json({ok: false, error:"document with that ID is not found"})
    return res.json(data)
    })

app.put("/documents/:id", async (req, res) => {
    const {id} = req.params
    const {content} = req.body
    const result = await updateDocument(id, content)
    if (!result) res.status(400).json({ok:false, error: "could not update document"})
    return res.status(201).json(result)
})

app.post("/documents", async (req, res) => {
    try {
        const {title, content=""} = req.body
        if (!title) return res.status(400).json({ok: false, error: "title is required" })
        const id = uuidv4()
        await createDocument(id, title, content)
        return res.status(201).json({ ok: true, id })
    } catch (err) {
        console.err(err)
        return res.status(500).json({ok: false, error: "Failed to create document"})
    }
})




const PORT = process.env.PORT || 5000
const server = app.listen(PORT, ()=> console.log(`API listening on ${PORT}`))

// create a websocket server that ATTACHES to the server above ^
const wss = new WebSocketServer({ server, path: "/ws" })
// the path is what the client will connect to (ws://localhost:5000/ws...)

// helper functions
function joinRoom(docId, ws) {
    const room = rooms.get(docId) ?? new Set()
    room.add(ws)
    rooms.set(docId, room)
    return room
}
function leaveRoom(docId, ws) {
    const room = rooms.get(docId)
    if(!room) return
    room.delete(ws)
    if (room.size === 0) {
        rooms.delete(docId)
    }
}

function broadcast(docId, senderWs, messageString) {
    const room = rooms.get(docId)
    if (!room) return
    for (const client of room) {
        if (client === senderWs) continue
        
    }
}

const rooms = new Map() // docId -> Set<ws>


wss.on("connection", (ws, req) => {
//     figure out which document they’re editing (docId)
//     store them in the correct “room”
//     listen for messages
//     clean up on close
    const url = new URL(req.url, `http://${req.headers.host}`)
    // req.url is the full URL of the request like /docs?docId=123
    // req.headers.host for example is localhost:5000
    // now we can parse the URL to get the docId
    const docId = url.searchParams.get("docId")
    if (!docId) {
        ws.close(1008, "docId required")
        return
    }
})


// wss.on("connection", (ws, req) => {
//     const url = new URL(req.url, `http://${req.headers.host}`)
//     const docId = url.searchParams.get("docId")

//     if(!docId) {
//         ws.close(1008, "docId required");
//         return; // return to close the connection
//     }
//     rooms.set(docId, ws)
// })

