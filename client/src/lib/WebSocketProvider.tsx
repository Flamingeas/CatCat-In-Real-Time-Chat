"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { WsEvent } from "@/types/chat";

type WebSocketContextType = {
  send: (event: any) => void;
  isConnected: boolean;
  setOnMessage: (callback: ((event: MessageEvent) => void) | null) => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const ws = new WebSocket("ws://127.0.0.1:8080/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      if (onMessageRef.current) {
        onMessageRef.current(event);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
    };

    ws.onerror = (err) => {
      console.error("[WS Global] error", err);
    };

    // Heartbeat
    const heartbeatId = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      }
    }, 15000);

    return () => {
      window.clearInterval(heartbeatId);
      ws.close();
    };
  }, []);

  function send(event: any) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }

  function setOnMessage(callback: ((event: MessageEvent) => void) | null) {
    onMessageRef.current = callback;
  }

  return (
    <WebSocketContext.Provider value={{ send, isConnected, setOnMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
}