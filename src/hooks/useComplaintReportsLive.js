// hooks/useComplaintReportsLive.js
import { useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

export default function useComplaintReportsLive(onUpdate) {
  useEffect(() => {
    const wsUrl = (process.env.REACT_APP_API_BASE_URL || "") + "/ws";
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      debug: () => {},
      onConnect: () => {
        client.subscribe("/topic/paginated-by-status", (message) => {
          try {
            // Parse JSON string from the message body
            const payload = JSON.parse(message.body);
            if (onUpdate) onUpdate(payload); // Pass to your handler
          } catch (err) {
            // Fallback: call with no args if payload missing
            if (onUpdate) onUpdate();
          }
        });
      },
    });
    client.activate();

    return () => {
      client.deactivate();
    };
  }, [onUpdate]);
}
