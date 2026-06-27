import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import WebSocket from "ws";
import * as Y from "yjs";

import { attachWs } from "./wsServer.js";
import { config } from "../config.js";

const REMOTE_ORIGIN = Symbol("remote");

function waitFor(predicate, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for collaboration state"));
      }
    }, 10);
  });
}

async function startServer(persistence) {
  const httpServer = http.createServer();
  const webSocketServer = attachWs(httpServer, persistence);
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();

  return {
    port,
    async close() {
      await new Promise((resolve) => webSocketServer.close(resolve));
      await new Promise((resolve) => httpServer.close(resolve));
    },
  };
}

function connectClient(port, cookie = "sid=allowed") {
  return new Promise((resolve, reject) => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?docId=doc-1`, {
      origin: config.CORS_ORIGIN,
      headers: cookie ? { cookie } : undefined,
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        Y.applyUpdate(ydoc, new Uint8Array(data), REMOTE_ORIGIN);
        return;
      }

      const message = JSON.parse(data.toString());
      if (message.type === "sync-complete") {
        resolve({ ws, ydoc, ytext });
      }
    });
    ws.on("error", reject);
  });
}

function createLocalInsert(ytext, index, value) {
  return new Promise((resolve) => {
    const onUpdate = (update, origin) => {
      if (origin !== REMOTE_ORIGIN) {
        ytext.doc.off("update", onUpdate);
        resolve(update);
      }
    };
    ytext.doc.on("update", onUpdate);
    ytext.insert(index, value);
  });
}

test("concurrent Yjs edits converge and survive a server restart", async () => {
  let content = "base";
  let state = null;
  const persistence = {
    async authenticateRequest(req) {
      if (req.headers.cookie === "sid=allowed") return { user: { id: "user-1" } };
      if (req.headers.cookie === "sid=viewer") return { user: { id: "user-2" } };
      return null;
    },
    async getDocumentRole(documentId, userId) {
      if (documentId !== "doc-1") return null;
      if (userId === "user-1") return "editor";
      if (userId === "user-2") return "viewer";
      return null;
    },
    async getDocumentById() {
      return { id: "doc-1", content };
    },
    async getDocumentYjsState() {
      return state;
    },
    async saveDocumentYjsState(next) {
      content = next.content;
      state = Uint8Array.from(next.state);
    },
  };

  const firstServer = await startServer(persistence);

  const rejectedOriginStatus = new Promise((resolve, reject) => {
    const rejectedOrigin = new WebSocket(
      `ws://127.0.0.1:${firstServer.port}/ws?docId=doc-1`,
      { origin: "https://malicious.example" }
    );
    rejectedOrigin.on("unexpected-response", (_request, response) => {
      response.resume();
      resolve(response.statusCode);
    });
    rejectedOrigin.on("open", () => reject(new Error("Unexpected WebSocket connection")));
    rejectedOrigin.on("error", () => {});
  });
  assert.equal(await rejectedOriginStatus, 403);

  const unauthorizedClose = new Promise((resolve, reject) => {
    const unauthorized = new WebSocket(
      `ws://127.0.0.1:${firstServer.port}/ws?docId=doc-1`,
      { origin: config.CORS_ORIGIN }
    );
    unauthorized.on("close", (code) => resolve(code));
    unauthorized.on("error", reject);
  });
  assert.equal(await unauthorizedClose, 1008);

  const viewer = await connectClient(firstServer.port, "sid=viewer");
  const viewerUpdate = await createLocalInsert(viewer.ytext, 0, "blocked");
  const viewerClose = new Promise((resolve) => {
    viewer.ws.on("close", (code) => resolve(code));
  });
  viewer.ws.send(viewerUpdate);
  assert.equal(await viewerClose, 1008);

  const first = await connectClient(firstServer.port);
  const second = await connectClient(firstServer.port);

  assert.equal(first.ytext.toString(), "base");
  assert.equal(second.ytext.toString(), "base");

  const firstUpdate = await createLocalInsert(first.ytext, 2, "X");
  const secondUpdate = await createLocalInsert(second.ytext, 2, "Y");
  first.ws.send(firstUpdate);
  second.ws.send(secondUpdate);

  await waitFor(() => first.ytext.toString() === second.ytext.toString());
  const convergedContent = first.ytext.toString();
  assert.equal(convergedContent.length, 6);
  assert.match(convergedContent, /X/);
  assert.match(convergedContent, /Y/);

  await waitFor(() => content === convergedContent && state?.length > 0);
  first.ws.close();
  second.ws.close();
  await waitFor(() => first.ws.readyState === WebSocket.CLOSED);
  await waitFor(() => second.ws.readyState === WebSocket.CLOSED);
  await firstServer.close();

  const secondServer = await startServer(persistence);
  const reconnected = await connectClient(secondServer.port);
  assert.equal(reconnected.ytext.toString(), convergedContent);

  reconnected.ws.close();
  await waitFor(() => reconnected.ws.readyState === WebSocket.CLOSED);
  await secondServer.close();
});
