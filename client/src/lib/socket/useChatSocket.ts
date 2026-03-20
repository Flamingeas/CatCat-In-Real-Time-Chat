"use client";

import { useEffect, useRef } from "react";

type ChatEvent =
    | { type: "auth"; token: string }
    | { type: "message"; content: string }
    | { type: "typing"; channelId: string }
    | { type: "presence"; userId: string; status: "online" | "offline" }
    | { type: "server_member_banned"; server_id: string; user_id: string; username: string };

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

            if (data.type === "server_member_banned") {
                console.log(`${data.username} has been banned from server ${data.server_id}`);

                const myId = localStorage.getItem("user_id");

                if (myId === data.user_id) {
                    alert("You have been banned from this server");
                }
            }
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
