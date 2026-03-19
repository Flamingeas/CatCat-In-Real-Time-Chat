"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8080/ws") as string;

type Server = {
    id: string;
    name: string;
    owner_id: string;
    invitation_code: string;
    created_at: string;
    updated_at: string;
};

type ChannelBarProps = {
    selectedServerId: string | null;
    servers: Server[];
    canCreateChannel: boolean;
    channels: Channel[];
    setChannels: (channels: Channel[]) => void;
    selectedChannelId: string | null;
    onOpenCreateChannel: () => void;
    setServers: (servers: Server[]) => void;
    onSelectChannel: (id: string) => void;
};

type Channel = {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
};

type MemberRole = "owner" | "admin" | "member";

type Member = {
    user_id: string;
    username: string;
    role?: MemberRole;
};

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

function LeaveIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 19V5a2 2 0 00-2-2h-6" />
        </svg>
    );
}

function GearIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.303.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

export default function ChannelBar({selectedServerId, servers, canCreateChannel, channels, setChannels, selectedChannelId, onOpenCreateChannel, setServers, onSelectChannel}: ChannelBarProps) {


    const selectedServer = useMemo(() => servers.find((s) => s.id === selectedServerId) ?? null, [servers, selectedServerId]);
    const selectedChannel = useMemo(() => channels.find((c) => String(c.id) === String(selectedChannelId)) ?? null, [channels, selectedChannelId]);

    const [isChannelCreateOpen, setIsChannelCreateOpen] = useState(false);
    const [channelEditError, setChannelEditError] = useState<string | null>(null);
    const [channelEditName, setChannelEditName] = useState("");

    const [isChannelEditOpen, setIsChannelEditOpen] = useState(false);
    const [isChannelSaving, setIsChannelSaving] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [settingsName, setSettingsName] = useState("");
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [me, setMe] = useState<{ id: string; username: string } | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const myRole: MemberRole = useMemo(() => {
        if (!me || !selectedServerId) return "member";
        if (selectedServer?.owner_id && String(selectedServer.owner_id) === String(me.id)) {
            return "owner";
        }
        const found = members.find((m) => String(m.user_id) === String(me.id));
        return (found?.role ?? "member") as MemberRole;
    }, [me, members, selectedServerId, selectedServer?.owner_id]);
    console.log(selectedChannelId)
    const isOwner = myRole === "owner";

    const canEditChannel = myRole === "owner" || myRole === "admin";
    function openServerSettings() {
        if (!selectedServer || !isOwner) return;
        setSettingsError(null);
        setDeleteConfirm("");
        setSettingsName(selectedServer.name);
        setIsSettingsOpen(true);
    }

    async function reloadChannels(selectedServerId: string) {
        try {
            const list = await api<Channel[]>(`/api/servers/${selectedServer.id}/channels`);
            setChannels(list);
            setSelectedChannelId((prev) => {
                if (prev && list.some((c) => String(c.id) === String(prev))) return prev;
                return list.length ? String(list[0].id) : null;
            });
        } catch (e: any) {
            const msg = String(e?.message ?? "");
            if (msg.startsWith("403")) pushToast("Accès refusé aux salons (403)", "warn");
            if (msg.startsWith("404")) pushToast("Salons introuvables (404)", "warn");
            setChannels([]);
            onSelectChannel(null);
        }
    }

    async function saveServerSettings() {
        if (!selectedServer || !isOwner) return;

        setSettingsError(null);
        const name = settingsName.trim();
        if (name.length < 3) return setSettingsError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setSettingsError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsSavingSettings(true);
            await api<Server>(`/api/servers/${selectedServer.id}`, {
                method: "PUT",
                body: JSON.stringify({ name }),
            });

            setIsSettingsOpen(false);
            await refreshServers(selectedServer.id);
        } catch (e: any) {
            setSettingsError(e?.message ?? "Impossible de renommer le serveur.");
        } finally {
            setIsSavingSettings(false);
        }
    }

    async function deleteServer() {
        if (!selectedServer || !isOwner) return;

        if (deleteConfirm.trim().toLowerCase() !== "delete") {
            setSettingsError("Tape DELETE pour confirmer la suppression.");
            return;
        }

        try {
            setIsSavingSettings(true);
            await api<void>(`/api/servers/${selectedServer.id}`, { method: "DELETE" });

            wsSend({ type: "leave_server", server_id: selectedServer.id });

            setIsSettingsOpen(false);

            const list = await api<Server[]>("/api/servers");
            setServers(list);
            setSelectedServerId(list.length ? list[0].id : null);
        } catch (e: any) {
            setSettingsError(e?.message ?? "Impossible de supprimer le serveur.");
        } finally {
            setIsSavingSettings(false);
        }
    }
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) return;
        try {
            const user = JSON.parse(storedUser);
            const id = String(user?.id ?? "");
            const username = String(user?.username ?? "");
            setMe(id ? { id, username } : null);
        } catch {
            setMe(null);
        }
    }, []);
            console.log(me);
            console.log(canEditChannel)

    console.log()
    async function refreshServers(selectId?: string) {
        const list = await api<Server[]>("/api/servers");
        setServers(list);
        if (selectId) setSelectedServerId(selectId);
        else if (!selectedServerId && list.length > 0) setSelectedServerId(list[0].id);
    }

    async function deleteChannel(channelId: string) {
        if (!selectedServerId) return;
        if (!canCreateChannel) return;

        try {
            await api<void>(`/api/channels/${channelId}`, { method: "DELETE" });

            setChannels((prev) => {
                const next = prev.filter((c) => String(c.id) !== String(channelId));

                setSelectedChannelId((prevSelected) => {
                    if (prevSelected && String(prevSelected) !== String(channelId)) return prevSelected;
                    return next.length ? String(next[0].id) : null;
                });

                return next;
            });

            pushToast("Salon supprimé", "warn");

            await reloadChannels(selectedServerId);
        } catch (e: any) {
            pushToast("Suppression refusée", "warn");
            console.error(e);
        }
    }

    function openEditChannel() {
        if (!canEditChannel) return;
        if (!selectedChannel) return;
        setChannelEditError(null);
        setChannelEditName(selectedChannel.name ?? "");
        setIsChannelEditOpen(true);
    }

    async function saveChannelEdit() {
        if (!canEditChannel) return;
        if (!selectedServerId) return;
        if (!selectedChannel) return;

        setChannelEditError(null);
        const name = channelEditName.trim();

        if (name.length < 3) return setChannelEditError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setChannelEditError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsChannelSaving(true);

            const updated = await api<Channel>(`/api/channels/${String(selectedChannel.id)}`, {
                method: "PUT",
                body: JSON.stringify({ name }),
            });

            setChannels((prev) =>
                prev.map((c) =>
                    String(c.id) === String(selectedChannel.id) ? { ...c, name: updated.name ?? name, updated_at: updated.updated_at ?? c.updated_at } : c
                )
            );

            setIsChannelEditOpen(false);
            pushToast("Salon renommé", "success");

            await reloadChannels(selectedServerId);
        } catch (e: any) {
            setChannelEditError(e?.message ?? "Impossible de renommer le salon.");
        } finally {
            setIsChannelSaving(false);
        }
    }
    return(
        <div>
            <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                <span className="mr-2 text-[#EB5E28]">&gt;</span>
                {selectedServer ? selectedServer.name : "Aucun serveur"}
                {selectedServer &&
                    (isOwner ? (
                        <button
                            onClick={openServerSettings}
                            title="Paramètres du serveur"
                            className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-[#ffffff]/10 transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                        >
                            <GearIcon />
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (!selectedServerId) return;
                                setLeaveError(null);
                                setIsLeaveOpen(true);
                            }}
                            title="Quitter le serveur"
                            className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-red-500/30 transition-colors text-red-300 hover:text-red-200 cursor-pointer"
                        >
                            <LeaveIcon />
                        </button>
                    ))}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)] flex items-center">
                    Salons
                    <button
                        onClick={onOpenCreateChannel}
                        disabled={!selectedServerId || !canCreateChannel}
                        title={!selectedServerId ? "Sélectionne un serveur" : canCreateChannel ? "Créer un salon" : "Seuls owner/admin"}
                        className={[
                            "ml-auto w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer",
                            selectedServerId && canCreateChannel ? "border-[#ffffff]/10 hover:bg-[#1E1211] text-[#EB5E28]" : "border-[#ffffff]/5 text-[#DCCBC4]/30 cursor-not-allowed",
                        ].join(" ")}
                    >
                        +
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {!selectedServerId ? (
                        <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">Sélectionne / crée un serveur.</div>
                    ) : channels.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">Aucun salon.</div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {channels.map((c) => {
                                const active = String(c.id) === String(selectedChannelId);
                                console.log(active);
                                return (
                                    <div
                                        key={c.id}
                                        className={[
                                            "group flex items-center gap-2 px-3 py-2 rounded-xl transition-colors font-[family-name:var(--font-nunito)]",
                                            active ? "bg-[#1E1211] text-white" : "hover:bg-[#1E1211] text-[#DCCBC4]/80",
                                        ].join(" ")}
                                        title={`#${c.name}`}
                                    >
                                        <button onClick={() => onSelectChannel(String(c.id))} className="flex-1 text-left min-w-0 cursor-pointer">
                                            <span className="text-[#EB5E28] mr-2">#</span>
                                            <span className="truncate">{c.name}</span>
                                        </button>

                                        {active && canEditChannel && (
                                            <button
                                                onClick={openEditChannel}
                                                title="Renommer le salon"
                                                className="p-2 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#1E1211] hover:text-white cursor-pointer"
                                            >
                                                <PencilIcon />
                                            </button>
                                        )}

                                        {canCreateChannel && (
                                            <button
                                                onClick={() => {
                                                    if (!window.confirm(`Supprimer le salon #${c.name} ?`)) return;
                                                    deleteChannel(String(c.id));
                                                }}
                                                title="Supprimer"
                                                className="group-hover:opacity-100 transition-opacity text-red-300 hover:text-red-200 px-2 cursor-pointer"
                                            >
                                                🗑
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {isChannelCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isChannelCreating && setIsChannelCreateOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Créer un salon</h3>
                            <button onClick={() => !isChannelCreating && setIsChannelCreateOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>

                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du salon</label>
                        <input
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            placeholder="ex: general"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />

                        {channelCreateError && <div className="mt-3 text-sm text-red-400">{channelCreateError}</div>}

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsChannelCreateOpen(false)}
                                disabled={isChannelCreating}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={createChannel}
                                disabled={isChannelCreating}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isChannelCreating ? "Création..." : "Créer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSettingsOpen && selectedServer && isOwner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isSavingSettings && setIsSettingsOpen(false)} />
                    <div className="relative w-full max-w-lg rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Paramètres du serveur</h3>
                                <div className="text-xs text-[#DCCBC4]/50 mt-1">Serveur: {selectedServer.name}</div>
                            </div>
                            <button onClick={() => !isSavingSettings && setIsSettingsOpen(false)} className="text-[#DCCBC4]/60 hover:text-white">
                                ✕
                            </button>
                        </div>
                        <div className="rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-4">
                            <div className="text-white font-bold mb-2">Renommer le serveur</div>
                            <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom</label>
                            <input
                                value={settingsName}
                                onChange={(e) => setSettingsName(e.target.value)}
                                className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                            />
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={saveServerSettings}
                                    disabled={isSavingSettings}
                                    className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingSettings ? "Sauvegarde..." : "Sauvegarder"}
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-red-500/20 bg-[#0a0605] p-4">
                            <div className="text-red-300 font-bold mb-1">Supprimer le serveur</div>
                            <div className="text-sm text-[#DCCBC4]/60">
                                Cette action est <span className="text-red-300 font-bold">irréversible</span>. Même s’il y a des membres dedans.
                            </div>
                            <div className="mt-3">
                                <div className="text-xs text-[#DCCBC4]/50 mb-2">
                                    Tape <span className="text-red-300 font-bold">DELETE</span> pour confirmer
                                </div>
                                <input
                                    value={deleteConfirm}
                                    onChange={(e) => setDeleteConfirm(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-red-500/20 focus:outline-none focus:ring-1 focus:ring-red-400"
                                />
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={deleteServer}
                                    disabled={isSavingSettings}
                                    className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingSettings ? "Suppression..." : "Supprimer"}
                                </button>
                            </div>
                        </div>
                        {settingsError && <div className="mt-4 text-sm text-red-400">{settingsError}</div>}
                    </div>
                </div>
            )}

            {isChannelEditOpen && selectedChannel && canEditChannel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isChannelSaving && setIsChannelEditOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Renommer le salon</h3>
                            <button onClick={() => !isChannelSaving && setIsChannelEditOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>

                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du salon</label>
                        <input
                            value={channelEditName}
                            onChange={(e) => setChannelEditName(e.target.value)}
                            placeholder="ex: general"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />

                        {channelEditError && <div className="mt-3 text-sm text-red-400">{channelEditError}</div>}

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsChannelEditOpen(false)}
                                disabled={isChannelSaving}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={saveChannelEdit}
                                disabled={isChannelSaving}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isChannelSaving ? "Sauvegarde..." : "Sauvegarder"}
                            </button>
                        </div>

                        <div className="mt-4 text-xs text-[#DCCBC4]/40">
                            Endpoint attendu: <span className="text-[#DCCBC4]/70">PUT /api/channels/:id</span> avec{" "}
                            <span className="text-[#DCCBC4]/70">{`{ name }`}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}