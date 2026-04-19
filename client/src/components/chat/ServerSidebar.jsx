import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogIn, Plus, Settings, LogOut } from "lucide-react";
import logoImage from "@/images/logo_catcat.svg";

export function ServerSidebar({
    servers,
    selectedServerId,
    onSelectServer,
    onOpenCreate,
    onOpenJoin,
    initials,
    onOpenUserSettings, // NOUVEAU
    onLogout            // NOUVEAU
}) {
    const [showUserMenu, setShowUserMenu] = useState(false);

    return (
        <div className="w-[72px] bg-[#1E1211] rounded-[20px] flex flex-col items-center py-6 gap-4 z-20 h-full shadow-lg relative">
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
                onClick={onOpenCreate}
                title="Créer un serveur"
                className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer"
            >
                <Plus className="w-6 h-6" />
            </button>
            
            <button
                onClick={onOpenJoin}
                title="Rejoindre un serveur"
                className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer mt-2"
            >
                <LogIn className="w-6 h-6 ml-1" />
            </button>

            {/* --- NOUVELLE ZONE UTILISATEUR --- */}
            <div className="mt-auto relative flex justify-center w-full">
                {showUserMenu && (
                    <>
                        {/* Overlay invisible pour fermer le menu en cliquant à côté */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                        
                        {/* Menu Popover */}
                        <div className="absolute bottom-0 left-16 mb-0 w-48 bg-[#0F0908] border border-[#ffffff]/10 rounded-xl shadow-2xl z-50 py-2 flex flex-col font-[family-name:var(--font-nunito)]">
                            <button 
                                onClick={() => { setShowUserMenu(false); onOpenUserSettings(); }} 
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#DCCBC4] hover:bg-[#1E1211] hover:text-white transition-colors text-left cursor-pointer"
                            >
                                <Settings className="w-4 h-4" /> Paramètres
                            </button>
                            <div className="h-px bg-[#ffffff]/5 my-1" />
                            <button 
                                onClick={() => { setShowUserMenu(false); onLogout(); }} 
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-[#1E1211] hover:text-red-300 transition-colors text-left cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" /> Déconnexion
                            </button>
                        </div>
                    </>
                )}

                <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-10 h-10 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs border-2 border-[#1E1211] hover:scale-105 transition-transform cursor-pointer shadow-md"
                >
                    {initials}
                </button>
            </div>
        </div>
    );
}