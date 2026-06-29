import { WebSocketServer } from "ws";
import * as Y from "yjs";

import {
  getDocumentById,
  getDocumentRole,
  getDocumentYjsState,
  saveDocumentYjsState,
} from "../repositories/documents.repo.js";
import { authenticateRequest } from "../middleware/auth.middleware.js";
import { config } from "../config.js";
import { subscribeToPermissionChanges } from "../services/permissionEvents.service.js";

const SAVE_DEBOUNCE_MS = 800;
const ROOM_CLEANUP_DELAY_MS = 30_000;
const MAX_UPDATE_BYTES = 5 * 1024 * 1024;

const defaultPersistence = {
  getDocumentById,
  getDocumentRole,
  getDocumentYjsState,
  saveDocumentYjsState,
  authenticateRequest,
};

function sendControl(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastControl(room, message) {
  for (const client of room.clients) {
    sendControl(client, message);
  }
}

function broadcastPresence(room) {
  const users = new Map();
  for (const client of room.clients) {
    if (client.documentUser) users.set(client.documentUser.id, client.documentUser);
  }
  broadcastControl(room, { type: "presence", users: [...users.values()] });
}

function broadcastUpdate(room, sender, update) {
  for (const client of room.clients) {
    if (client !== sender && client.readyState === 1) {
      client.send(update, { binary: true });
    }
  }
}

export function attachWs(server, overrides = {}) {
  const persistence = { ...defaultPersistence, ...overrides };
  const rooms = new Map();
  const roomPromises = new Map();
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: MAX_UPDATE_BYTES,
    perMessageDeflate: false,
    verifyClient(info, done) {
      if (info.origin !== config.CORS_ORIGIN) {
        done(false, 403, "Origin not allowed");
        return;
      }
      done(true);
    },
  });

  const unsubscribe = subscribeToPermissionChanges(({ documentId, userId, role }) => {
    const room = rooms.get(documentId);
    if (!room) return;
    for (const client of room.clients) {
      if (client.documentUser?.id !== userId) continue;
      client.documentRole = role;
      sendControl(client, { type: "permission-changed", role });
    }
  });
  wss.once("close", unsubscribe);

  async function persistRoom(room) {
    if (room.saveTimer) {
      clearTimeout(room.saveTimer);
      room.saveTimer = null;
    }
    if (room.saving || room.savedVersion === room.version) return;

    room.saving = true;
    const version = room.version;

    try {
      await persistence.saveDocumentYjsState({
        id: room.id,
        content: room.ytext.toString(),
        state: Y.encodeStateAsUpdate(room.ydoc),
      });
      room.savedVersion = version;

      if (room.savedVersion === room.version) {
        broadcastControl(room, { type: "saved" });
      }
    } catch (error) {
      console.error(`Failed to persist Yjs document ${room.id}`, error);
      broadcastControl(room, {
        type: "save-error",
        error: "Failed to save document",
      });
    } finally {
      room.saving = false;
      if (room.savedVersion !== room.version) {
        scheduleSave(room);
      }
    }
  }

  function scheduleSave(room) {
    if (room.saveTimer) clearTimeout(room.saveTimer);
    room.saveTimer = setTimeout(() => {
      void persistRoom(room);
    }, SAVE_DEBOUNCE_MS);
  }

  async function createRoom(docId) {
    const document = await persistence.getDocumentById(docId);
    if (!document) return null;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    const persistedState = await persistence.getDocumentYjsState(docId);

    if (persistedState?.length) {
      Y.applyUpdate(ydoc, new Uint8Array(persistedState));
    } else if (document.content) {
      ytext.insert(0, document.content);
    }

    const room = {
      id: docId,
      ydoc,
      ytext,
      clients: new Set(),
      version: 0,
      savedVersion: persistedState?.length ? 0 : -1,
      saving: false,
      saveTimer: null,
      cleanupTimer: null,
    };

    ydoc.on("update", (update, origin) => {
      room.version += 1;
      broadcastUpdate(room, origin, update);
      scheduleSave(room);
    });

    if (!persistedState?.length) {
      await persistence.saveDocumentYjsState({
        id: docId,
        content: ytext.toString(),
        state: Y.encodeStateAsUpdate(ydoc),
      });
      room.savedVersion = room.version;
    }

    return room;
  }

  async function getRoom(docId) {
    const existing = rooms.get(docId);
    if (existing) return existing;

    if (!roomPromises.has(docId)) {
      const roomPromise = createRoom(docId).then((room) => {
        if (room) rooms.set(docId, room);
        return room;
      }).finally(() => {
        roomPromises.delete(docId);
      });
      roomPromises.set(docId, roomPromise);
    }

    return roomPromises.get(docId);
  }

  function scheduleRoomCleanup(room) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);

    const cleanup = async () => {
      if (room.clients.size > 0) return;
      await persistRoom(room);

      if (
        room.clients.size === 0
        && !room.saving
        && room.savedVersion === room.version
      ) {
        rooms.delete(room.id);
        room.ydoc.destroy();
      } else if (room.clients.size === 0) {
        room.cleanupTimer = setTimeout(cleanup, SAVE_DEBOUNCE_MS);
        room.cleanupTimer.unref?.();
      }
    };

    room.cleanupTimer = setTimeout(cleanup, ROOM_CLEANUP_DELAY_MS);
    room.cleanupTimer.unref?.();
  }

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const docId = url.searchParams.get("docId");

    if (!docId) {
      ws.close(1008, "docId required");
      return;
    }

    try {
      const auth = await persistence.authenticateRequest(req);
      if (!auth) {
        ws.close(1008, "Authentication required");
        return;
      }

      const role = await persistence.getDocumentRole(docId, auth.user.id);
      if (!role) {
        ws.close(1008, "Document access denied");
        return;
      }

      const room = await getRoom(docId);
      if (!room) {
        ws.close(1008, "Document not found");
        return;
      }

      if (room.cleanupTimer) {
        clearTimeout(room.cleanupTimer);
        room.cleanupTimer = null;
      }
      room.clients.add(ws);
      ws.documentRole = role;
      ws.documentUser = { id: auth.user.id, email: auth.user.email };

      ws.send(Y.encodeStateAsUpdate(room.ydoc), { binary: true });
      sendControl(ws, { type: "sync-complete", role });
      broadcastPresence(room);
      console.log(
        `Yjs connected: doc=${docId}, user=${auth.user.id}, role=${role}, clients=${room.clients.size}`
      );

      ws.on("message", (data, isBinary) => {
        if (!isBinary) {
          ws.close(1003, "Binary Yjs updates required");
          return;
        }
        if (!["owner", "editor"].includes(ws.documentRole)) {
          ws.close(1008, "Read-only document access");
          return;
        }

        try {
          const update = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          Y.applyUpdate(room.ydoc, update, ws);
        } catch (error) {
          console.error(`Invalid Yjs update for document ${docId}`, error);
          ws.close(1003, "Invalid Yjs update");
        }
      });

      ws.on("close", () => {
        room.clients.delete(ws);
        broadcastPresence(room);
        console.log(
          `Yjs disconnected: doc=${docId}, user=${auth.user.id}, clients=${room.clients.size}`
        );
        if (room.clients.size === 0) scheduleRoomCleanup(room);
      });
    } catch (error) {
      console.error(`Failed to open Yjs document ${docId}`, error);
      ws.close(1011, "Could not load document");
    }
  });

  return wss;
}
