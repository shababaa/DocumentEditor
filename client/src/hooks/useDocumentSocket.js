import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

const REMOTE_ORIGIN = Symbol("remote-yjs-update");
const RECONNECT_DELAY_MS = 1_000;

function createWebSocketUrl(id) {
  const apiUrl = new URL(import.meta.env.VITE_API_BASE);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, "")}/ws`;
  apiUrl.search = "";
  apiUrl.searchParams.set("docId", id);
  return apiUrl.toString();
}

export function useDocumentSocket({ id, enabled, canEdit = true }) {
  const session = useMemo(() => {
    if (!enabled || !id) return null;
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    return {
      ydoc,
      ytext,
      undoManager: new Y.UndoManager(ytext),
    };
  }, [id, enabled]);
  const [status, setStatus] = useState({
    id: null,
    ready: false,
    connectionStatus: "connecting",
    saveStatus: "saved",
    error: null,
  });

  const currentStatus = status.id === id
    ? status
    : {
        id,
        ready: false,
        connectionStatus: "connecting",
        saveStatus: "saved",
        error: null,
      };

  useEffect(() => {
    if (!session || !id) return undefined;

    const { ydoc } = session;
    let ws = null;
    let disposed = false;
    let hasSynced = false;
    let hasUnsavedLocalChanges = false;
    let reconnectTimer = null;
    let queuedUpdates = [];

    function updateStatus(patch) {
      setStatus((previous) => ({
        ...(previous.id === id ? previous : {
          ready: false,
          connectionStatus: "connecting",
          saveStatus: "saved",
          error: null,
        }),
        id,
        ...patch,
      }));
    }

    function syncLocalState() {
      if (ws?.readyState !== WebSocket.OPEN) return;

      // A full state update is idempotent and also recovers edits whose socket
      // message may have been interrupted before the previous connection closed.
      ws.send(Y.encodeStateAsUpdate(ydoc));
      queuedUpdates = [];
    }

    function handleLocalUpdate(update, origin) {
      if (origin === REMOTE_ORIGIN) return;
      if (!canEdit) return;
      hasUnsavedLocalChanges = true;
      updateStatus({ saveStatus: "saving" });

      if (hasSynced && ws?.readyState === WebSocket.OPEN) {
        ws.send(update);
      } else {
        queuedUpdates.push(update);
      }
    }

    function handleControlMessage(rawMessage) {
      let message;
      try {
        message = JSON.parse(rawMessage);
      } catch {
        updateStatus({ error: "The collaboration server returned an invalid message." });
        return;
      }

      if (message.type === "sync-complete") {
        const hadPendingUpdates = hasUnsavedLocalChanges || queuedUpdates.length > 0;
        hasSynced = true;
        updateStatus({
          ready: true,
          connectionStatus: "connected",
          saveStatus: hadPendingUpdates ? "saving" : "saved",
          error: null,
        });
        syncLocalState();
      } else if (message.type === "saved") {
        hasUnsavedLocalChanges = false;
        updateStatus({ saveStatus: "saved" });
      } else if (message.type === "save-error") {
        updateStatus({
          saveStatus: "error",
          error: message.error || "Failed to save document.",
        });
      }
    }

    function connect() {
      if (disposed) return;

      const socket = new WebSocket(createWebSocketUrl(id));
      socket.binaryType = "arraybuffer";
      ws = socket;

      socket.onmessage = async (event) => {
        if (typeof event.data === "string") {
          handleControlMessage(event.data);
          return;
        }

        const data = event.data instanceof Blob
          ? await event.data.arrayBuffer()
          : event.data;
        if (hasSynced) updateStatus({ saveStatus: "saving" });
        Y.applyUpdate(ydoc, new Uint8Array(data), REMOTE_ORIGIN);
      };

      socket.onerror = () => {
        updateStatus({ connectionStatus: "disconnected" });
      };

      socket.onclose = (event) => {
        if (ws !== socket || disposed) return;
        hasSynced = false;
        updateStatus({ connectionStatus: "disconnected", saveStatus: "saving" });

        if (event.code === 1003 || event.code === 1008) {
          updateStatus({
            error: event.reason || "The collaboration connection was rejected.",
          });
          return;
        }

        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    ydoc.on("update", handleLocalUpdate);
    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      ydoc.off("update", handleLocalUpdate);
    };
  }, [id, session, canEdit]);

  return {
    ...session,
    ready: currentStatus.ready,
    connectionStatus: currentStatus.connectionStatus,
    saveStatus: currentStatus.saveStatus,
    error: currentStatus.error,
  };
}
