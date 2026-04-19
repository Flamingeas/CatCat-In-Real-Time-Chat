import Image from "next/image";
import Link from "next/link";
import logoImage from "@/images/logo_catcat.svg"; // Vérifie que ce chemin est bon selon ton architecture

function EnterIcon() {
    return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 19V5a2 2 0 00-2-2h-6" />
        </svg>
    );
}

export function ServerSidebar({
    servers,
    selectedServerId,
    onSelectServer,
    onOpenCreate,
    onOpenJoin,
    initials
}) {
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
                onClick={onOpenCreate}
                title="Créer un serveur"
                className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>
            <button
                onClick={onOpenJoin}
                title="Rejoindre un serveur"
                className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer mt-2"
            >
                <EnterIcon />
            </button>
            <div className="mt-auto w-10 h-10 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs border-2 border-[#1E1211]">
                {initials}
            </div>
        </div>
    );
}