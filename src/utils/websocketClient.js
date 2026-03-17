// websocketClient.js
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

let clientRef = null;

/**
 * Build a WebSocket URL from an http(s) base.
 * https://api.example.com -> wss://api.example.com/ws/websocket
 */
function toWsUrl(httpBase) {
  // remove trailing slash
  const base = (httpBase || "").replace(/\/+$/, "");
  if (!base) {
    // same-origin: derive from window.location
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/websocket`;
  }
  const wsProto = base.startsWith("https:") ? "wss:" : "ws:";
  const hostAndPath = base.replace(/^https?:/, "");
  return `${wsProto}${hostAndPath}/ws/websocket`;
}

/**
 * Create a STOMP client using native WebSocket (best for proxies).
 * If your server ONLY exposes SockJS (no native ws), switch to sockjsFactory().
 */
function websocketFactory(base) {
  const url = toWsUrl(base);
  return new WebSocket(url);
}

/**
 * Optional: SockJS fallback if you must use SockJS endpoint (/ws).
 * Some proxies require additional CORS config for XHR-streaming.
 */
function sockjsFactory(base) {
  const b = (base || "").replace(/\/+$/, "");
  const url = b ? `${b}/ws` : "/ws";
  // NOTE: SockJS options vary by version; if you rely on cookies across origins,
  // prefer token auth instead of cookies.
  return new SockJS(url);
}

/**
 * Connects and subscribes to topics.
 * @param {(data:any)=>void} onCourierUpdate
 * @param {(data:any)=>void} onTrendUpdate
 * @param {object} [opts]
 *   opts.baseUrl   - REACT_APP_API_BASE_URL
 *   opts.token     - optional JWT/session token to send in connectHeaders or query param
 *   opts.useSockJS - force SockJS transport instead of native WebSocket
 */
export function connectWebSocket(onCourierUpdate, onTrendUpdate, opts = {}) {
  const { baseUrl = process.env.REACT_APP_API_BASE_URL, token, useSockJS = false } = opts;

  // Make a brand-new client per mount.
  const client = new Client({
    // Prefer native websocket (recommended behind proxies/load balancers)
    webSocketFactory: () => (useSockJS ? sockjsFactory(baseUrl) : websocketFactory(baseUrl)),

    // Helpful logs during integration; turn off once stable
    debug: (str) => console.log("[STOMP]", str),

    // Backoff & heartbeats
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    // If you have a JWT, include it here so backend can authenticate the socket
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  client.onConnect = () => {
    console.log("[STOMP] connected");

    const safeParse = (msg) => {
      try { return JSON.parse(msg?.body ?? "{}"); } catch { return null; }
    };

    // Broadcast topics (no user prefix)
    client.subscribe("/topic/courier-status", (message) => {
      const data = safeParse(message);
      if (data && typeof onCourierUpdate === "function") onCourierUpdate(data);
    });

    // Either of these, depending on your server
    const handleTrend = (message) => {
      const data = safeParse(message);
      if (data && typeof onTrendUpdate === "function") onTrendUpdate(data);
    };
    client.subscribe("/topic/hardware-trends", handleTrend);
    client.subscribe("/topic/courier-trends", handleTrend);
  };

  client.onStompError = (frame) => {
    console.error("[STOMP] broker error:", frame.headers["message"], frame.body);
  };
  client.onWebSocketError = (evt) => {
    console.error("[STOMP] websocket error:", evt);
  };
  client.onDisconnect = () => {
    console.log("[STOMP] disconnected");
  };

  client.activate();
  clientRef = client; // keep a reference to THIS instance
}

export function disconnectWebSocket() {
  const c = clientRef;
  clientRef = null;
  if (c?.active) {
    // Make sure we only deactivate the instance we created for this mount
    c.deactivate();
  }
}

export const isWebSocketConnected = () => !!clientRef?.connected;
