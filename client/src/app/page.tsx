"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { Nunito, Fredoka } from "next/font/google";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl"; 
import { 
    MessageSquare, 
    LogOut, 
    Download, 
    Monitor, 
    Terminal, 
    ChevronDown 
} from "lucide-react";

import AuthModal from "./components/AuthModal";
import LanguageSwitcher from "./components/LanguageSwitcher"; 
import { getApiBaseUrl } from "@/lib/api-url";

// Importation des assets (images)
import heroImage from "./images/catcat_illustration_hero.png";
import logoImage from "./images/logo_catcat.svg";
import serverImage from "./images/feature_server.png"; 
import chatImage from "./images/feature_chat.png"; 
import moderationImage from "./images/feature_moderation.jpg"; 

const API_BASE = getApiBaseUrl();
const WINDOWS_DOWNLOAD_URL =
  "https://github.com/EpitechMscProPromo2028/T-DEV-600-PAR_12/releases/latest/download/CatCat.exe";
const LINUX_DOWNLOAD_URL =
  "https://github.com/EpitechMscProPromo2028/T-DEV-600-PAR_12/releases/latest/download/CatCat.deb";

// --- POLICES ---
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["600", "700"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "700"] });

const TypoGraphica = localFont({ src: "./fonts/TypoGraphica_demo.woff", variable: "--font-typographica", display: "swap" });
const Cocogoose = localFont({ src: "./fonts/Cocogoose-Pro-Regular-trial.ttf", variable: "--font-cocogoose", display: "swap" });
const Salks = localFont({ src: "./fonts/Salks.woff", variable: "--font-salks", display: "swap" });
const Dunkin = localFont({ src: "./fonts/Dunkin.woff", variable: "--font-dunkin", weight: "400" });

// --- TYPES ---
interface User {
  id: string;
  username: string;
}

function isRunningInTauri() {
  if (typeof window === "undefined") return false;

  const tauriWindow = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return (
    "__TAURI__" in tauriWindow ||
    "__TAURI_INTERNALS__" in tauriWindow ||
    navigator.userAgent.toLowerCase().includes("tauri")
  );
}

export default function Home() {
  const router = useRouter();
  const t = useTranslations(); 
  
  // États
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false); // Pour éviter le flash d'hydratation
  const [isTauriApp, setIsTauriApp] = useState(false);
  const showDownloadSection = isMounted && !isTauriApp;

  function refreshAuthState() {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    setIsAuthed(!!token);
    
    if (token) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try { setMe(JSON.parse(storedUser)); } catch {}
      }
    } else {
      setMe(null);
    }
  }

  useEffect(() => {
    refreshAuthState();
    setIsTauriApp(isRunningInTauri());
    setIsMounted(true); // Marque le composant comme monté côté client

    const onStorage = (e: StorageEvent) => {
      if (e.key === "access_token") refreshAuthState();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openAuthModal = () => setIsModalOpen(true);
  const closeAuthModal = () => {
    setIsModalOpen(false);
    refreshAuthState();
  };

  const goChat = () => router.push("/chat");
  
  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      setIsAuthed(false);
      setMe(null);
      router.push("/");
      router.refresh();
    }
  }

  const initials = me?.username ? me.username.slice(0, 2).toUpperCase() : "??";

  return (
      <main className={`min-h-[100dvh] relative bg-[#1E1211] text-[#FFF8F0] ${nunito.variable} ${Cocogoose.variable} ${TypoGraphica.variable} ${fredoka.variable} ${Dunkin.variable} ${Salks.variable} font-sans selection:bg-[#FF7F50] selection:text-white overflow-x-hidden`}>
        
        <AuthModal isOpen={isModalOpen} onClose={closeAuthModal} />
        
        {/* === NAVBAR === */}
        <nav className="fixed top-0 left-0 right-0 z-50 h-[auto] min-h-[70px] pt-[env(safe-area-inset-top)] px-4 md:px-8 flex justify-between items-center bg-[#1E1211]/80 backdrop-blur-md">
          
          <div className="flex items-center gap-2 md:gap-3 group cursor-[url('/paw.png'),_pointer] transition-transform duration-300 ease-in-out hover:scale-105">
            <div className="relative w-8 h-8 md:w-10 md:h-10 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12">
              <Image src={logoImage} alt={t("hero.logoAlt")} fill className="object-contain" />
            </div>
            <span className="font-[family-name:var(--font-dunkin)] text-xl md:text-2xl pt-1 text-[#FFF8F0] transition-colors duration-300 group-hover:text-[#FF7F50]">
              CatCat
            </span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <LanguageSwitcher /> 
            
            {/* Gestion du flash d'hydratation pour l'auth */}
            {!isMounted ? (
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[#ffffff]/5 rounded-full animate-pulse"></div>
            ) : !isAuthed ? (
                <button
                    onClick={openAuthModal}
                    className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-xs md:text-base px-4 py-2 md:px-6 md:py-2.5 text-[#3E1C0A] bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                >
                  <span className="hidden sm:inline">{t("nav.login")}</span>
                  <span className="sm:hidden">Login</span>
                </button>
            ) : (
                <div className="relative group">
                  <button className="w-10 h-10 md:w-12 md:h-12 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs md:text-sm border-2 border-[#1E1211] hover:scale-105 transition-transform shadow-[0_0_15px_rgba(190,242,100,0.3)] cursor-pointer">
                    {initials}
                  </button>

                  <div className="absolute top-full right-0 mt-3 w-56 bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden font-[family-name:var(--font-nunito)] z-50">
                    <div className="px-4 py-3 border-b border-[#ffffff]/5 bg-[#1E1211]/50">
                      <p className="text-xs text-[#DCCBC4]/60 uppercase tracking-wider font-bold mb-0.5">{t("nav.loggedInAs")}</p>
                      <p className="text-sm font-bold text-white truncate">@{me?.username}</p>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      <button onClick={goChat} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-[#DCCBC4] hover:bg-[#1E1211] hover:text-[#EB5E28] rounded-xl transition-colors cursor-pointer text-left w-full">
                        <MessageSquare className="w-4 h-4" /> {t("nav.goToChat")}
                      </button>
                      <div className="h-px bg-[#ffffff]/5 my-1 mx-2" />
                      <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-400 hover:bg-[#1E1211] hover:text-red-300 rounded-xl transition-colors cursor-pointer text-left w-full">
                        <LogOut className="w-4 h-4" /> {t("nav.logout")}
                      </button>
                    </div>
                  </div>
                </div>
            )}
          </div>
        </nav>
        
        {/* === SECTION 1 : HERO === */}
        <section className="relative w-full min-h-[100dvh] overflow-hidden flex flex-col pt-[70px] md:pt-[80px]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[60px] z-10 pointer-events-none lg:hidden"></div>
          
          <div className="relative z-20 container mx-auto px-6 lg:px-12 flex-1 flex flex-col justify-center items-center lg:items-start pb-20">
            <div className="w-full lg:max-w-[50%] space-y-6 md:space-y-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl md:text-6xl lg:text-7xl leading-[1.1] text-[#E89E68]">
                {t("hero.title")} <span className="text-[#FF7F50]">{t("hero.titleHighlight")} </span>{t("hero.titleEnd")}
              </h1>

              <div className="w-12 md:w-16 h-1.5 md:h-2 bg-[#E89E68] rounded-full"></div>

              <p className="font-[family-name:var(--font-nunito)] font-bold text-base md:text-xl text-[#DCCBC4] leading-relaxed lg:pr-4">
                {t("hero.description")}
              </p>

              {!isMounted ? (
                  <div className="h-[56px] w-[220px] bg-[#ffffff]/5 rounded-full animate-pulse"></div>
              ) : !isAuthed ? (
                  <button onClick={openAuthModal} className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-3.5 font-[family-name:var(--font-cocogoose)] text-base md:text-lg text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)]">
                    {t("hero.cta")}
                  </button>
              ) : (
                  <button onClick={goChat} className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-3.5 font-[family-name:var(--font-salks)] text-xl md:text-2xl text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)]">
                    {t("hero.ctaAuthed")}
                  </button>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 right-0 h-[90%] w-[160%] lg:w-[65%] z-0 pointer-events-none">
            <Image src={heroImage} alt={t("hero.imageAlt")} fill priority className="object-cover object-center lg:object-contain lg:object-bottom-right drop-shadow-2xl" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
        </section>

        {/* === SECTION 1.5 : DOWNLOAD === */}
        {showDownloadSection && (
        <section className="relative z-30 py-24 px-6 md:px-12 flex flex-col items-center text-center bg-[#0a0605] border-t border-[#ffffff]/5">
            <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#E89E68]/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#FF7F50]/20 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
                <div className="w-20 h-20 bg-[#EB5E28] text-[#1E1211] rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(235,94,40,0.3)] transform -rotate-6">
                    <Download className="w-10 h-10" strokeWidth={2.5} />
                </div>
                
                <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl md:text-6xl leading-[1.1] text-[#FFF8F0] mb-6">
                    {t("download.titlePart1")} <br/> <span className="text-[#FF7F50]">{t("download.titleHighlight")}</span>
                </h2>
                
                <p className="font-[family-name:var(--font-nunito)] text-lg md:text-xl text-[#DCCBC4]/90 max-w-2xl mb-12">
                    {t("download.description")}
                </p>

                <div className="relative group inline-block">
                    <button className="flex items-center gap-3 px-8 py-4 bg-[#EB5E28] text-[#1E1211] font-[family-name:var(--font-cocogoose)] text-lg rounded-full hover:bg-white transition-all shadow-[0_0_20px_rgba(235,94,40,0.3)] hover:scale-105 cursor-pointer">
                        <Download className="w-5 h-5" />
                        {t("download.button")}
                        <ChevronDown className="w-5 h-5 transition-transform duration-300 group-hover:rotate-180" />
                    </button>

                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-72 bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden font-[family-name:var(--font-nunito)] z-50 text-left">
                        <a href={WINDOWS_DOWNLOAD_URL} className="flex items-center gap-4 px-5 py-4 w-full hover:bg-[#1E1211] text-[#DCCBC4] hover:text-[#EB5E28] border-b border-[#ffffff]/5">
                            <Monitor className="w-6 h-6 flex-shrink-0" />
                            <div>
                                <div className="font-bold text-base">{t("download.os.windows")}</div>
                                <div className="text-xs opacity-60">{t("download.os.windowsDesc")}</div>
                            </div>
                        </a>
                        <a href={LINUX_DOWNLOAD_URL} className="flex items-center gap-4 px-5 py-4 w-full hover:bg-[#1E1211] text-[#DCCBC4] hover:text-[#EB5E28]">
                            <Terminal className="w-6 h-6 flex-shrink-0" />
                            <div>
                                <div className="font-bold text-base">{t("download.os.linux")}</div>
                                <div className="text-xs opacity-60">{t("download.os.linuxDesc")}</div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </section>
        )}

        {/* === SECTION 2 : FEATURES === */}
        <section id="features" className="relative z-20 py-16 md:py-24 px-6 md:px-12 bg-[#0F0908] border-t border-[#ffffff]/5">
            <div className="max-w-6xl mx-auto flex flex-col gap-20 md:gap-32">
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-20">
                    <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
                        <h2 className="text-3xl md:text-5xl lg:text-6xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold leading-[1.1]">
                            {t("features.feature1.titlePart1")} <br className="hidden md:block" /> <span className="text-[#FF7F50]">{t("features.feature1.titleHighlight")}</span>
                        </h2>
                        <div className="w-10 md:w-12 h-1 md:h-1.5 bg-[#FF7F50] rounded-full mx-auto md:mx-0"></div>
                        <p className="text-base md:text-lg font-[family-name:var(--font-nunito)] text-[#DCCBC4]/80 leading-relaxed font-bold">
                            {t("features.feature1.description")}
                        </p>
                    </div>
                    <div className="flex-1 w-full">
                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden flex items-center justify-center group">
                            <Image src={serverImage} alt={t("features.feature1.imageAlt")} fill className="object-cover transition-transform duration-500 group-hover:scale-105" /> 
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-20">
                    <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
                        <h2 className="text-3xl md:text-5xl lg:text-6xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold leading-[1.1]">
                            {t("features.feature2.titlePart1")} <br className="hidden md:block" /> {t("features.feature2.titlePart2")} <span className="text-[#FF7F50]">{t("features.feature2.titleHighlight")}</span>
                        </h2>
                        <div className="w-10 md:w-12 h-1 md:h-1.5 bg-[#FF7F50] rounded-full mx-auto md:mx-0"></div>
                        <p className="text-base md:text-lg font-[family-name:var(--font-nunito)] text-[#DCCBC4]/80 leading-relaxed font-bold">
                            {t("features.feature2.description")}
                        </p>
                    </div>
                    <div className="flex-1 w-full">
                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden flex items-center justify-center group">
                             <Image src={chatImage} alt={t("features.feature2.imageAlt")} fill className="object-cover transition-transform duration-500 group-hover:scale-105" /> 
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* === SECTION 3 : CTA FINAL === */}
        <section className="relative z-20 py-16 md:py-24 px-6 text-center bg-[#0a0605] border-t border-[#ffffff]/5">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[200px] bg-[#FF7F50]/10 blur-[120px] rounded-full pointer-events-none" />
            <h2 className="text-3xl md:text-5xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold mb-8 md:mb-10">
                {t("ctaFinal.title")}
            </h2>
            
            {!isMounted ? (
                <div className="h-[60px] w-[240px] bg-[#ffffff]/5 rounded-full animate-pulse mx-auto"></div>
            ) : !isAuthed ? (
                <button onClick={openAuthModal} className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-10 md:py-4 font-[family-name:var(--font-cocogoose)] text-base md:text-xl text-[#3E1C0A] bg-[#EB5E28] rounded-full hover:bg-white shadow-[0_0_30px_rgba(255,127,80,0.3)]">
                  {t("ctaFinal.buttonUnauthed")}
                </button>
            ) : (
                <button onClick={goChat} className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-10 md:py-4 font-[family-name:var(--font-salks)] text-xl md:text-2xl text-[#3E1C0A] bg-[#EB5E28] rounded-full hover:bg-white shadow-[0_0_30px_rgba(255,127,80,0.3)]">
                  {t("ctaFinal.buttonAuthed")}
                </button>
            )}
        </section>

        {/* === FOOTER === */}
        <footer className="relative z-20 bg-[#0F0908] py-8 border-t border-[#ffffff]/5 text-center text-[#DCCBC4]/40 font-[family-name:var(--font-nunito)] font-bold text-xs md:text-sm px-4">
            <p>&copy; {new Date().getFullYear()} {t("footer.copyright")}</p>
        </footer>

      </main>
  );
}
