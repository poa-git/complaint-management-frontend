// hooks/useComplaintReportsLive.js
import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";

export default function useComplaintReportsLive(onUpdate) {
  // ✅ useRef so the WS handler always calls the latest onUpdate
  // without needing to reconnect every time the callback changes
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

    // ✅ Native WebSocket — Railway doesn't support SockJS reliably
    // Converts: https://example.com → wss://example.com/ws/websocket
    //           http://localhost:8080 → ws://localhost:8080/ws/websocket
    const wsUrl =
      API_BASE_URL.replace(/^https/, "wss").replace(/^http/, "ws") +
      "/ws/websocket";

    const client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      onConnect: () => {
        client.subscribe("/topic/paginated-by-status", (message) => {
          try {
            const payload =
              typeof message.body === "string"
                ? JSON.parse(message.body)
                : message.body;
            // ✅ Always uses latest onUpdate — no stale closure
            if (onUpdateRef.current) onUpdateRef.current(payload);
          } catch {
            if (onUpdateRef.current) onUpdateRef.current();
          }
        });
      },
      onDisconnect: () => console.warn("WS disconnected — will auto-reconnect"),
    });

    client.activate();

    return () => client.deactivate();
  }, []); // ✅ Empty deps — connect once, never recreated
}