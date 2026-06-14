import { WebSocketServer } from "ws";

const rooms = new Map()

  function joinRoom(docId, ws) {
    const room = rooms.get(docId) ?? new Set();
    room.add(ws);
    rooms.set(docId, room);
  }

  function leaveRoom (docId, ws) {
    const room = rooms.get(docId);
    if (!room) return;

    room.delete(ws)

    if (room.size === 0) {
      rooms.delete(docId)
    }
  }

  function broadcast (docId, senderWs, messageString) {
    const room = rooms.get(docId);
    if (!room) return;

    for (const client of room) {
      if (client === senderWs) continue

      if (client.readyState === 1) {
        client.send(messageString)
      }
    }
  }

export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    const docId = url.searchParams.get("docId");
    const clientId = url.searchParams.get("clientId");

    if (!docId) {
      ws.close(1008, "docId required");
      return;
    }

    joinRoom(docId, ws);

    console.log(`WS connected: doc=${docId}, client=${clientId}`);
    console.log(`Room size for ${docId}: ${rooms.get(docId).size}`);

    ws.on("message", (data) => {
      const messageString = data.toString();
      broadcast(docId, ws, messageString);
    });

    ws.on("close", () => {
      leaveRoom(docId, ws);
      console.log(`WS disconnected: doc=${docId}, client=${clientId}`);
    });
  });

  return wss;
}