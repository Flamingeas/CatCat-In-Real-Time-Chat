import { Toast } from "@/types/chat";

interface ToastStackProps {
    toasts: Toast[];
}

export function ToastStack({ toasts }: ToastStackProps) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={[
                        "px-4 py-3 rounded-2xl border shadow-xl text-sm font-[family-name:var(--font-nunito)]",
                        toast.kind === "success" ? "bg-[#0a0605] border-green-500/30 text-green-200" : "",
                        toast.kind === "warn" ? "bg-[#0a0605] border-red-500/30 text-red-200" : "",
                        toast.kind === "info" ? "bg-[#0a0605] border-[#ffffff]/10 text-[#DCCBC4]" : "",
                    ].join(" ")}
                >
                    {toast.text}
                </div>
            ))}
        </div>
    );
}
