// toast.store.ts
import { useState } from "react";

export type Toast = {
    id: string;
    text: string;
    kind: "info" | "success" | "warn";
};

let listeners: ((toasts: Toast[]) => void)[] = [];
let currentToasts: Toast[] = [];

function notify() {
    listeners.forEach((l) => l(currentToasts));
}

export function pushToast(text: string, kind: Toast["kind"] = "info") {
    const id = `${Date.now()}_${Math.random()}`;

    currentToasts = [...currentToasts, { id, text, kind }];
    notify();

    setTimeout(() => {
        currentToasts = currentToasts.filter((t) => t.id !== id);
        notify();
    }, 2500);
}

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>(currentToasts);

    useState(() => {
        listeners.push(setToasts);
        return () => {
            listeners = listeners.filter((l) => l !== setToasts);
        };
    });

    return toasts;
}