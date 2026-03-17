// hooks/useComplaintReportsLive.js
import { useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

export default function useComplaintReportsLive(onUpdate) {
  useEffect(() => {
    const apiBase = process.env.REACT_APP_API_BASE_URL || window.location.origin;

    // Build a proper absolute URL for SockJS
    const wsUrl = new URL("/ws", apiBase).toString();

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      debug: () => {},

      onConnect: () => {
        client.subscribe("/topic/paginated-by-status", (message) => {
          try {
            const payload = JSON.parse(message.body);

            // Old backend format:
            // {
            //   complaintId: "...",
            //   action: "updated" | "created"
            // }

            if (onUpdate) {
              onUpdate({
                complaintId: payload?.complaintId || null,
                action: payload?.action || null,
              });
            }
          } catch (err) {
            console.error("WebSocket payload parse error:", err);
          }
        });
      },

      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },

      onWebSocketError: (event) => {
        console.error("WebSocket error:", event);
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [onUpdate]);
}