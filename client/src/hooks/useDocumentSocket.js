import { useEffect, useRef } from "react";

export function useDocumentSocket ({ id, content, setContent, enabled }) {
  
  const wsRef = useRef(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const ignoreNextSendRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!id) return;

    const API = import.meta.env.VITE_API_BASE;
    const wsBase = API.replace(/^http/, "ws");

    const wsUrl = `${wsBase}/ws?docId=${id}&clientId=${clientIdRef.current}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WS connected");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.clientId === clientIdRef.current) return;

      if (msg.type === "doc:update") {
        ignoreNextSendRef.current = true;
        setContent(msg.content);
      }
    };

    ws.onclose = () => {
      console.log("WS closed");
    };

    return () => {
      ws.close();
    };
  }, [id, enabled, setContent])


  useEffect(() => {
    if (!enabled) return;
    if (!id) return;

    const ws = wsRef.current;

    if (!ws) return;
    if (ws.readyState !== 1) return;

    if (ignoreNextSendRef.current) {
      ignoreNextSendRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const message = {
        type: "doc:update",
        docId: id,
        clientId: clientIdRef.current,
        content,
      };

      ws.send(JSON.stringify(message));
    }, 200);

    return () => clearTimeout(timer);
  }, [content, id, enabled]);

}