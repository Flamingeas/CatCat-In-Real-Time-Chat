"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Server = {
    id: string;
    name: string;
    owner_id: string;
    invitation_code: string;
    created_at: string;
    updated_at: string;
};

type NavBarProps = {
    selectedServerId: string | null;
    onSelectServer: (id: string) => void;
    servers: Server[];
    onServersChange: (servers: Server[]) => void;
};

import logoImage from "../images/logo_catcat.svg";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8080/ws") as string;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} - ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

function getInitials(username?: string) {
    if (!username || username.length < 1) return "??";
    const first = username[0].toUpperCase();
    const last = username[username.length - 1].toUpperCase();
    return `${first}${last}`;
}

function CrownIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 13H5L3 7zm4.1 11h9.8l.9-6.1-3 2.3L12 9.2l-2.8 4.9-3-2.3L7.1 18z" />
        </svg>
    );
}

function UserPlusIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11a4 4 0 100-8 4 4 0 000 8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M23 11h-6" />
        </svg>
    );
}

function EnterIcon() {
    return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 19V5a2 2 0 00-2-2h-6" />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
    );
}

type Toast = { id: string; text: string; kind: "info" | "success" | "warn" };

export default function NavBar({ selectedServerId, onSelectServer, servers, onServersChange }: NavBarProps){

    const [initials, setInitials] = useState("??");
    const [me, setMe] = useState<{ id: string; username: string } | null>(null);


    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [serverName, setServerName] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoinOpen, setIsJoinOpen] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);


    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const router = useRouter();
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

    const selectedServerIdRef = useRef<string | null>(null);


    function pushToast(text: string, kind: Toast["kind"] = "info") {
        const id = `${Date.now()}_${Math.random()}`;
        setToasts((prev) => [...prev, { id, text, kind }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
    }

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) return;
        try {
            const user = JSON.parse(storedUser);
            const id = String(user?.id ?? "");
            const username = String(user?.username ?? "");
            setMe(id ? { id, username } : null);
            setInitials(getInitials(username));
        } catch {
            setMe(null);
            setInitials("??");
        }
    }, []);


    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");
        if (!token || !storedUser) {
            router.replace("/");
            return;
        }
        setHasCheckedAuth(true);
    }, [router]);

    useEffect(() => {
        (async () => {
            try {
                const list = await api<Server[]>("/api/servers");
                onServersChange(list);
                if (!selectedServerId && list.length > 0) onSelectServer(list[0].id);
            } catch (e) {
                console.error("Failed to load servers:", e);
            }
        })();
    }, []);


    async function createServer() {
        setCreateError(null);
        const name = serverName.trim();

        if (name.length < 3) return setCreateError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setCreateError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsCreating(true);
            const created = await api<Server>("/api/servers", { method: "POST", body: JSON.stringify({ name }) });
            setIsCreateOpen(false);
            setServerName("");
            await refreshServers(created.id);
        } catch (e: any) {
            setCreateError(e?.message ?? "Impossible de créer le serveur.");
        } finally {
            setIsCreating(false);
        }
    }

    async function refreshServers(selectId?: string) {
        const list = await api<Server[]>("/api/servers");
        onServersChange(list);
        if (selectId) onSelectServer(selectId);
        else if (!selectedServerId && list.length > 0) onSelectServer(list[0].id);
    }

    useEffect(() => {
        selectedServerIdRef.current = selectedServerId;
    }, [selectedServerId]);

    async function joinServer() {
        setJoinError(null);
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 8) {
            setJoinError("Le code doit faire 8 caractères.");
            return;
        }
        try {
            setIsJoining(true);
            const joined = await api<Server>("/api/servers/join", {
                method: "POST",
                body: JSON.stringify({ invitation_code: code }),
            });

            setIsJoinOpen(false);
            setJoinCode("");

            await refreshServers(joined.id);

            wsSend({ type: "join_server", server_id: joined.id });
            await reloadMembers(joined.id);
            await reloadChannels(joined.id);

            pushToast(`Tu as rejoint ${joined.name}`, "success");
        } catch (e: any) {
            setJoinError(e?.message ?? "Impossible de rejoindre ce serveur.");
        } finally {
            setIsJoining(false);
        }
    }

    if (!hasCheckedAuth) return null;

    return (
        <div className="w-[72px] bg-[#1E1211] rounded-[20px] flex flex-col items-center py-6 gap-4 z-20 h-full shadow-lg">
                <Link href="/" className="w-12 h-12 flex items-center justify-center hover:rounded-xl transition-all cursor-pointer group">
                    <div className="relative w-12 h-12 transition-transform duration-300 group-hover:rotate-12">
                        <Image src={logoImage} alt="Logo CatCat" />
                    </div>
                </Link>
                <div className="w-8 h-[2px] bg-[#ffffff]/10 rounded-full" />
                <div className="flex flex-col items-center gap-3 w-full px-2">
                    {servers.map((s) => {
                        const active = s.id === selectedServerId;
                        return (
                            <button
                                key={s.id}
                                onClick={() => onSelectServer(s.id)}
                                title={s.name}
                                className={[
                                    "w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all cursor-pointer flex items-center justify-center",
                                    active ? "bg-[#EB5E28] text-white" : "bg-[#2A1A18] text-[#EB5E28] hover:bg-[#EB5E28] hover:text-white",
                                ].join(" ")}
                            >
                                <span className="font-bold text-sm">{s.name?.slice(0, 2).toUpperCase() || "SV"}</span>
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    title="Créer un serveur"
                    className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                <button
                    onClick={() => setIsJoinOpen(true)}
                    title="Rejoindre un serveur"
                    className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer mt-2"
                >
                    <EnterIcon />
                </button>
                <div className="mt-auto w-10 h-10 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs border-2 border-[#1E1211]">
                    {initials}
                </div>

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isCreating && setIsCreateOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Créer un serveur</h3>
                            <button onClick={() => !isCreating && setIsCreateOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>
                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du serveur</label>
                        <input
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                            placeholder="ex: CatCat Dev Server"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />
                        {createError && <div className="mt-3 text-sm text-red-400">{createError}</div>}
                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                disabled={isCreating}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={createServer}
                                disabled={isCreating}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isCreating ? "Création..." : "Créer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isJoinOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isJoining && setIsJoinOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Rejoindre un serveur</h3>
                            <button onClick={() => !isJoining && setIsJoinOpen(false)} className="text-[#DCCBC4]/60 hover:text-white">
                                ✕
                            </button>
                        </div>
                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Code d’invitation</label>
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="ex: 7F2K9A1B"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />
                        {joinError && <div className="mt-3 text-sm text-red-400">{joinError}</div>}
                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsJoinOpen(false)}
                                disabled={isJoining}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={joinServer}
                                disabled={isJoining}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50"
                            >
                                {isJoining ? "Rejoindre..." : "Rejoindre"}
                            </button>
                        </div>
                        <div className="mt-4 text-xs text-[#DCCBC4]/40">
                            Endpoint attendu: <span className="text-[#DCCBC4]/70">POST /api/servers/join</span> avec{" "}
                            <span className="text-[#DCCBC4]/70">{`{ invitation_code }`}</span>
                        </div>
                    </div>
                </div>
            )}
            </div>
    );
}
