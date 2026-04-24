"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import logoImage from "@/app/images/logo_catcat.svg";
import { EnterIcon } from "../icons";

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

// --- COMPOSANT MODAL DES PARAMÈTRES ---
function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const t = useTranslations("settings");
    const currentLocale = useLocale();
    const router = useRouter();

    // États du formulaire
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    if (!isOpen) return null;

    const switchLocale = (newLocale: string) => {
        if (newLocale === currentLocale) return;
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
        router.refresh();
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Appeler ton API backend ici pour sauvegarder les modifications (username, email, password)
        console.log("Sauvegarde des paramètres...", { username, email, password });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0F0908] border border-[#ffffff]/10 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative font-[family-name:var(--font-nunito)]">
                
                {/* Bouton Fermer */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[#DCCBC4]/60 hover:text-[#FF7F50] transition-colors"
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
                        <label className="block text-sm font-bold text-[#DCCBC4] mb-1.5">{t("username")}</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t("usernamePlaceholder")}
                            className="w-full bg-[#1E1211] border border-[#ffffff]/10 rounded-xl px-4 py-3 text-[#FFF8F0] placeholder-[#DCCBC4]/30 focus:outline-none focus:border-[#EB5E28] transition-colors"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-bold text-[#DCCBC4] mb-1.5">{t("email")}</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("emailPlaceholder")}
                            className="w-full bg-[#1E1211] border border-[#ffffff]/10 rounded-xl px-4 py-3 text-[#FFF8F0] placeholder-[#DCCBC4]/30 focus:outline-none focus:border-[#EB5E28] transition-colors"
                        />
                    </div>

                    {/* Mot de passe */}
                    <div>
                        <label className="block text-sm font-bold text-[#DCCBC4] mb-1.5">{t("password")}</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-[#1E1211] border border-[#ffffff]/10 rounded-xl px-4 py-3 text-[#FFF8F0] placeholder-[#DCCBC4]/30 focus:outline-none focus:border-[#EB5E28] transition-colors"
                        />
                    </div>

                    {/* Sélecteur de Langue */}
                    <div className="pt-2">
                        <label className="block text-sm font-bold text-[#DCCBC4] mb-2">{t("language")}</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => switchLocale("fr")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${currentLocale === "fr" ? "bg-[#EB5E28] text-[#1E1211]" : "bg-[#1E1211] text-[#DCCBC4] hover:bg-[#ffffff]/5 border border-[#ffffff]/10"}`}
                            >
                                🇫🇷 Français
                            </button>
                            <button
                                type="button"
                                onClick={() => switchLocale("en")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${currentLocale === "en" ? "bg-[#EB5E28] text-[#1E1211]" : "bg-[#1E1211] text-[#DCCBC4] hover:bg-[#ffffff]/5 border border-[#ffffff]/10"}`}
                            >
                                🇬🇧 English
                            </button>
                        </div>
                    </div>

                    {/* Bouton de sauvegarde */}
                    <button 
                        type="submit"
                        className="w-full mt-6 bg-[#EB5E28] text-[#1E1211] font-[family-name:var(--font-cocogoose)] font-bold py-3.5 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(235,94,40,0.3)] hover:scale-[1.02]"
                    >
                        {t("save")}
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- COMPOSANT PRINCIPAL SERVERLIST ---
export function ServerList({ servers, selectedServerId, onSelectServer, onCreate, onJoin, initials, view, onToggleView, unreadDmCount }: ServerListProps) {
    const t = useTranslations("serverList");
    
    // 👇 Nouvel état pour gérer l'ouverture du Modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <>
            {/* Modal des paramètres */}
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <div className="w-[72px] bg-[#1E1211] rounded-[20px] flex flex-col items-center py-6 gap-4 z-20 h-full shadow-lg">
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
                        view === "dm" ? "bg-[#EB5E28] text-white" : "bg-[#2A1A18] text-[#EB5E28] hover:bg-[#EB5E28] hover:text-white",
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
                
                <div className="w-8 h-[2px] bg-[#ffffff]/10 rounded-full" />
                
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
                                    active ? "bg-[#EB5E28] text-white" : "bg-[#2A1A18] text-[#EB5E28] hover:bg-[#EB5E28] hover:text-white",
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
                    className="w-12 h-12 flex-shrink-0 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer mt-auto"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                
                <button
                    onClick={onJoin}
                    title={t("joinServer")}
                    className="w-12 h-12 flex-shrink-0 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer mt-2"
                >
                    <EnterIcon />
                </button>

                {/* 👇 Ton avatar est maintenant un bouton qui ouvre les paramètres ! */}
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