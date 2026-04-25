"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "next-themes"; // 👈 Import de next-themes
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sun, Moon, Laptop } from "lucide-react"; // 👈 Import des icônes
import logoImage from "@/app/images/logo_catcat.svg";
import { EnterIcon } from "../icons";
import { api, ApiError } from "@/lib/api";

interface Server {
    id: string;
    name: string;
}

interface ServerListProps {
    servers: Server[];
    selectedServerId: string | null;
    onSelectServer: (id: string) => void;
    onCreate: () => void;
    onJoin: () => void;
    initials: string;
    view: "servers" | "dm";
    onToggleView: () => void;
    unreadDmCount: number;
}

function formatBadgeCount(count: number) {
    return count > 99 ? "99+" : String(count);
}

interface UserProfile {
    id: string;
    username: string;
}

// --- COMPOSANT MODAL DES PARAMÈTRES ---
function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const t = useTranslations("settings");
    const currentLocale = useLocale();
    const router = useRouter();
    const { theme, setTheme } = useTheme(); // 👈 Utilisation du hook useTheme

    // États du formulaire
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setPassword("");
        setError(null);

        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setUsername(String(user?.username ?? ""));
            } catch {}
        }

        api<UserProfile>("/api/users/me")
            .then((profile) => {
                setUsername(profile.username ?? "");
            })
            .catch(() => {});
    }, [isOpen]);

    if (!isOpen) return null;

    const switchLocale = (newLocale: string) => {
        if (newLocale === currentLocale) return;
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
        window.dispatchEvent(new Event("localechange"));
        router.refresh();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload: Record<string, string> = {};
        const trimmedUsername = username.trim();

        if (trimmedUsername) payload.username = trimmedUsername;
        if (password.trim()) payload.password = password;

        if (password.trim() && password.trim().length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        if (Object.keys(payload).length === 0) {
            onClose();
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            const profile = await api<UserProfile>("/api/users/me", {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            localStorage.setItem("user", JSON.stringify(profile));
            window.dispatchEvent(new CustomEvent("userchange", { detail: profile }));
            onClose();
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("Unable to update account settings.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Remplacement des couleurs en dur par bg-surface, border-border, etc. */}
            <div className="bg-surface border border-border-custom rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative font-[family-name:var(--font-nunito)]">
                
                {/* Bouton Fermer */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted hover:text-accent-hover transition-colors cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h2 className="text-2xl font-[family-name:var(--font-fredoka)] text-[#E89E68] font-bold mb-6">
                    {t("title")}
                </h2>

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Nom d'utilisateur */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-1.5">{t("username")}</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t("usernamePlaceholder")}
                            className="w-full bg-background border border-border-custom rounded-xl px-4 py-3 text-primary placeholder-muted/50 focus:outline-none focus:border-accent transition-colors"
                        />
                    </div>

                    {/* Mot de passe */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-1.5">{t("password")}</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-background border border-border-custom rounded-xl px-4 py-3 text-primary placeholder-muted/50 focus:outline-none focus:border-accent transition-colors"
                        />
                    </div>

                    {/* 👇 SÉLECTEUR DE THÈME 👇 */}
                    <div className="pt-2">
                        <label className="block text-sm font-bold text-muted mb-2">{t("theme", { fallback: "Thème de l'application" })}</label>
                        <div className="flex bg-background border border-border-custom rounded-xl p-1">
                            <button
                                type="button"
                                onClick={() => setTheme("light")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${theme === "light" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"}`}
                            >
                                <Sun className="w-4 h-4" /> Clair
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme("dark")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${theme === "dark" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"}`}
                            >
                                <Moon className="w-4 h-4" /> Sombre
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme("system")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${theme === "system" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"}`}
                            >
                                <Laptop className="w-4 h-4" /> Auto
                            </button>
                        </div>
                    </div>

                    {/* Sélecteur de Langue */}
                    <div className="pt-2">
                        <label className="block text-sm font-bold text-muted mb-2">{t("language")}</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => switchLocale("fr")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${currentLocale === "fr" ? "bg-accent text-[#1E1211]" : "bg-background text-muted hover:bg-surface border border-border-custom"}`}
                            >
                                🇫🇷 Français
                            </button>
                            <button
                                type="button"
                                onClick={() => switchLocale("en")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${currentLocale === "en" ? "bg-accent text-[#1E1211]" : "bg-background text-muted hover:bg-surface border border-border-custom"}`}
                            >
                                🇬🇧 English
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm font-bold text-red-400">
                            {error}
                        </p>
                    )}

                    {/* Bouton de sauvegarde */}
                    <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full mt-6 bg-accent text-[#1E1211] font-[family-name:var(--font-cocogoose)] font-bold py-3.5 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(235,94,40,0.3)] hover:scale-[1.02] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isSaving ? "..." : t("save")}
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- COMPOSANT PRINCIPAL SERVERLIST ---
export function ServerList({ servers, selectedServerId, onSelectServer, onCreate, onJoin, initials, view, onToggleView, unreadDmCount }: ServerListProps) {
    const t = useTranslations("serverList");
    
    // Nouvel état pour gérer l'ouverture du Modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <>
            {/* Modal des paramètres */}
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <div className="w-[72px] bg-background rounded-[20px] flex flex-col items-center py-6 gap-4 z-20 h-full shadow-lg">
                <Link href="/" className="w-12 h-12 flex items-center justify-center hover:rounded-xl transition-all cursor-pointer group">
                    <div className="relative w-12 h-12 transition-transform duration-300 group-hover:rotate-12">
                        <Image src={logoImage} alt={t("logoAlt")} />
                    </div>
                </Link>
                
                <button
                    onClick={onToggleView}
                    title={t("directMessages")}
                    className={[
                        "relative w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all cursor-pointer flex items-center justify-center",
                        view === "dm" ? "bg-accent text-[#1E1211]" : "bg-secondary text-accent hover:bg-accent hover:text-[#1E1211]",
                    ].join(" ")}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {unreadDmCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-[#bef264] text-[#1E1211] border-2 border-[#1E1211] text-[10px] font-black flex items-center justify-center">
                            {formatBadgeCount(unreadDmCount)}
                        </span>
                    )}
                </button>
                
                <div className="w-8 h-[2px] bg-border-custom rounded-full" />
                
                <div className="flex flex-col items-center gap-3 w-full px-2 overflow-y-auto overflow-x-hidden no-scrollbar">
                    {servers.map((s) => {
                        const active = view === "servers" && s.id === selectedServerId;
                        return (
                            <button
                                key={s.id}
                                onClick={() => onSelectServer(s.id)}
                                title={s.name}
                                className={[
                                    "w-12 h-12 flex-shrink-0 rounded-[24px] hover:rounded-[16px] transition-all cursor-pointer flex items-center justify-center",
                                    active ? "bg-accent text-[#1E1211]" : "bg-secondary text-accent hover:bg-accent hover:text-[#1E1211]",
                                ].join(" ")}
                            >
                                <span className="font-bold text-sm">{s.name?.slice(0, 2).toUpperCase() || "SV"}</span>
                            </button>
                        );
                    })}
                </div>
                
                <button
                    onClick={onCreate}
                    title={t("createServer")}
                    className="w-12 h-12 flex-shrink-0 bg-secondary rounded-[24px] hover:rounded-[16px] text-accent hover:text-[#1E1211] hover:bg-accent flex items-center justify-center transition-all cursor-pointer mt-auto"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                
                <button
                    onClick={onJoin}
                    title={t("joinServer")}
                    className="w-12 h-12 flex-shrink-0 bg-secondary rounded-[24px] hover:rounded-[16px] text-accent hover:text-[#1E1211] hover:bg-accent flex items-center justify-center transition-all cursor-pointer mt-2"
                >
                    <EnterIcon />
                </button>

                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    title={t("settings")}
                    className="mt-4 mb-2 w-10 h-10 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs border-2 border-[#1E1211] cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_rgba(190,242,100,0.4)] transition-all"
                >
                    {initials}
                </button>
            </div>
        </>
    );
}
