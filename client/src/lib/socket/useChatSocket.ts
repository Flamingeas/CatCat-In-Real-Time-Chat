"use client";

import { useEffect, useRef } from "react";

type ChatEvent =
    | { type: "auth"; token: string }
    | { type: "message"; content: string }
    | { type: "typing"; channelId: string }
    | { type: "presence"; userId: string; status: "online" | "offline" };

export function useChatSocket() {
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const ws = new WebSocket("ws://127.0.0.1:8080/ws");

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "auth", token }));
        };

        ws.onmessage = (event) => {
            const data: ChatEvent = JSON.parse(event.data);
            console.log("[WS]", data);
        };

        ws.onclose = () => {
            console.log("[WS] closed");
        };

        ws.onerror = (err) => {
            console.error("[WS] error", err);
        };

        wsRef.current = ws;

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, []);

    function send(event: ChatEvent) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(event));
        }
    }

    return { send };
}
