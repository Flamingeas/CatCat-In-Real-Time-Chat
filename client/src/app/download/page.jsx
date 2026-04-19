"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Nunito, Fredoka } from "next/font/google";
import { useRouter } from "next/navigation";
import { 
    MessageSquare, LogOut, Sparkles, Download, 
    Monitor, Laptop, Globe, ArrowRight, CheckCircle2, Terminal
} from "lucide-react";
import AuthModal from "../../components/AuthModal";
import logoImage from "../../images/logo_catcat.svg"; 

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

// --- POLICES ---
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["600", "700"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "700"] });

const TypoGraphica = localFont({ src: "../fonts/TypoGraphica_demo.woff", variable: "--font-typographica", display: "swap" });
const Cocogoose = localFont({ src: "../fonts/Cocogoose-Pro-Regular-trial.ttf", variable: "--font-cocogoose", display: "swap" });
const Salks = localFont({ src: "../fonts/Salks.woff", variable: "--font-salks", display: "swap" });
const Dunkin = localFont({ src: "../fonts/Dunkin.woff", variable: "--font-dunkin", weight: "400" });

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export default function DownloadPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [me, setMe] = useState(null);

  function refreshAuthState() {
    const token = getToken();
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
    function onStorage(e) { if (e.key === "access_token") refreshAuthState(); }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openAuthModal = () => setIsModalOpen(true);
  const closeAuthModal = () => { setIsModalOpen(false); refreshAuthState(); };
  const goChat = () => router.push("/chat");
  
  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } finally {
      clearAuth();
      setIsAuthed(false);
      setMe(null);
      router.push("/");
      router.refresh();
    }
  }

  const initials = me?.username ? me.username.slice(0, 2).toUpperCase() : "??";

  return (
      <main className={`min-h-[100dvh] relative bg-[#0a0605] text-[#FFF8F0] ${nunito.variable} ${Cocogoose.variable} ${fredoka.variable} ${Dunkin.variable} ${Salks.variable} font-sans selection:bg-[#FF7F50] selection:text-white overflow-x-hidden`}>
        
        <AuthModal isOpen={isModalOpen} onClose={closeAuthModal} />
        
        {/* === NAVBAR === */}
        <nav className="fixed top-0 left-0 right-0 z-50 h-[80px] px-4 md:px-8 flex justify-between items-center bg-[#1E1211]/80 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3 group cursor-[url('/paw.png'),_pointer] transition-transform duration-300 ease-in-out hover:scale-105">
            <div className="relative w-10 h-10 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12">
              <Image src={logoImage} alt="Logo CatCat" fill className="object-contain" />
            </div>
            <span className="font-[family-name:var(--font-dunkin)] text-2xl pt-1 text-[#FFF8F0] transition-colors duration-300 group-hover:text-[#FF7F50]">
              CatCat
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-2 font-[family-name:var(--font-cocogoose)] text-base tracking-wide">
            <Link href="/#features" className="px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
              Présentation
            </Link>
            <Link href="/projet" className="px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
              Le Projet
            </Link>
            {/* Bouton "Télécharger" actif */}
            <Link href="/download" className="px-5 py-2 rounded-full text-[#1E1211] bg-[#EB5E28] transition-all duration-300 cursor-pointer">
              Télécharger
            </Link>
            <Link href="/demo" className="flex items-center gap-2 px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
                Démo Interactive
            </Link>
          </div>

          <div className="flex items-center">
            {!isAuthed ? (
                <button onClick={openAuthModal} className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-sm md:text-base px-6 py-2.5 text-[#3E1C0A] bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]">
                  Connexion / Inscription
                </button>
            ) : (
                <div className="relative group">
                  <button className="w-12 h-12 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-sm border-2 border-[#1E1211] hover:scale-105 transition-transform shadow-[0_0_15px_rgba(190,242,100,0.3)] cursor-pointer">
                    {initials}
                  </button>
                  <div className="absolute top-full right-0 mt-3 w-56 bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden font-[family-name:var(--font-nunito)]">
                    <div className="px-4 py-3 border-b border-[#ffffff]/5 bg-[#1E1211]/50">
                      <p className="text-xs text-[#DCCBC4]/60 uppercase tracking-wider font-bold mb-0.5">Connecté en tant que</p>
                      <p className="text-sm font-bold text-white truncate">@{me?.username}</p>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      <button onClick={goChat} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-[#DCCBC4] hover:bg-[#1E1211] hover:text-[#EB5E28] rounded-xl transition-colors cursor-pointer text-left w-full">
                        <MessageSquare className="w-4 h-4" /> Ouvrir CatCat
                      </button>
                      <div className="h-px bg-[#ffffff]/5 my-1 mx-2" />
                      <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-400 hover:bg-[#1E1211] hover:text-red-300 rounded-xl transition-colors cursor-pointer text-left w-full">
                        <LogOut className="w-4 h-4" /> Déconnexion
                      </button>
                    </div>
                  </div>
                </div>
            )}
          </div>
        </nav>

        {/* === HERO DOWNLOAD SECTION === */}
        <section className="relative pt-[160px] pb-32 px-6 md:px-12 flex flex-col items-center text-center overflow-hidden min-h-[70vh] justify-center bg-[#0F0908]">
            
            {/* 👇 PLACEHOLDER POUR TON ILLUSTRATION BACKGROUND 👇 */}
            {/* Retire ce div et ajoute ton composant <Image /> en absolute ici plus tard */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#E89E68]/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#FF7F50]/15 blur-[120px] rounded-full" />
            </div>
            {/* 👆 FIN DU PLACEHOLDER BACKGROUND 👆 */}

            <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
                <div className="w-20 h-20 bg-[#EB5E28] text-[#1E1211] rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(235,94,40,0.4)] transform -rotate-6">
                    <Download className="w-10 h-10" strokeWidth={2.5} />
                </div>
                
                <h1 className="font-[family-name:var(--font-fredoka)] font-bold text-5xl md:text-7xl leading-[1.1] text-[#FFF8F0] mb-6 drop-shadow-lg">
                    Emporte CatCat <br/> <span className="text-[#FF7F50]">partout avec toi.</span>
                </h1>
                
                <p className="font-[family-name:var(--font-nunito)] text-lg md:text-xl text-[#DCCBC4]/90 max-w-2xl mb-12 drop-shadow-md">
                    Profite d'une expérience ultra-fluide. CatCat est conçu pour être léger, rapide et ne jamais te ralentir, que tu sois en train de jouer, de coder ou de chiller.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <button className="flex items-center gap-3 px-8 py-4 bg-[#EB5E28] text-[#1E1211] font-[family-name:var(--font-cocogoose)] text-lg rounded-full hover:bg-white transition-all shadow-[0_0_20px_rgba(235,94,40,0.3)] hover:scale-105 group">
                        <Monitor className="w-5 h-5" />
                        Télécharger pour Windows
                    </button>
                    <span className="text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)] text-sm">
                        Windows 10/11 (64-bit)
                    </span>
                </div>
            </div>
        </section>

        {/* === AUTRES PLATEFORMES === */}
        <section className="py-24 px-6 md:px-12 bg-[#1E1211] border-t border-[#ffffff]/5">
            <div className="max-w-6xl mx-auto">
                <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-3xl md:text-4xl text-center text-[#E89E68] mb-16">
                    Aussi disponible sur d'autres systèmes
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* Carte Mac */}
                    <div className="bg-[#0F0908] p-8 rounded-3xl border border-[#ffffff]/5 flex flex-col items-center text-center group hover:border-[#FF7F50]/30 transition-all">
                        <div className="w-16 h-16 bg-[#1E1211] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Laptop className="w-8 h-8 text-[#DCCBC4] group-hover:text-[#FF7F50] transition-colors" />
                        </div>
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-2">Mac OS</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#DCCBC4]/60 text-sm mb-8">Puces Apple Silicon & Intel</p>
                        <button className="mt-auto px-6 py-2.5 bg-[#1E1211] text-[#DCCBC4] rounded-full font-bold text-sm hover:bg-[#FF7F50] hover:text-[#1E1211] transition-colors w-full">
                            Télécharger .dmg
                        </button>
                    </div>

                    {/* Carte Linux */}
                    <div className="bg-[#0F0908] p-8 rounded-3xl border border-[#ffffff]/5 flex flex-col items-center text-center group hover:border-[#FF7F50]/30 transition-all">
                        <div className="w-16 h-16 bg-[#1E1211] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Terminal className="w-8 h-8 text-[#DCCBC4] group-hover:text-[#FF7F50] transition-colors" />
                        </div>
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-2">Linux</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#DCCBC4]/60 text-sm mb-8">Debian, Ubuntu & AppImage</p>
                        <button className="mt-auto px-6 py-2.5 bg-[#1E1211] text-[#DCCBC4] rounded-full font-bold text-sm hover:bg-[#FF7F50] hover:text-[#1E1211] transition-colors w-full">
                            Télécharger .deb
                        </button>
                    </div>

                    {/* Carte Web */}
                    <div className="bg-[#0F0908] p-8 rounded-3xl border border-[#ffffff]/5 flex flex-col items-center text-center group hover:border-[#FF7F50]/30 transition-all">
                        <div className="w-16 h-16 bg-[#1E1211] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Globe className="w-8 h-8 text-[#DCCBC4] group-hover:text-[#FF7F50] transition-colors" />
                        </div>
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-2">Navigateur</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#DCCBC4]/60 text-sm mb-8">Rien à installer, accessible partout</p>
                        <button onClick={goChat} className="mt-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1E1211] text-[#DCCBC4] rounded-full font-bold text-sm hover:bg-[#FF7F50] hover:text-[#1E1211] transition-colors w-full">
                            Ouvrir l'App Web <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                </div>
            </div>
        </section>

        {/* === HIGHLIGHTS === */}
        <section className="py-20 px-6 bg-[#0a0605]">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-center gap-8 md:gap-16">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#EB5E28]" />
                    <span className="font-[family-name:var(--font-nunito)] text-[#DCCBC4] font-bold">Léger & Rapide</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#EB5E28]" />
                    <span className="font-[family-name:var(--font-nunito)] text-[#DCCBC4] font-bold">Mises à jour automatiques</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#EB5E28]" />
                    <span className="font-[family-name:var(--font-nunito)] text-[#DCCBC4] font-bold">Mode sombre natif</span>
                </div>
            </div>
        </section>

        {/* === FOOTER === */}
        <footer className="relative z-20 bg-[#1E1211] py-8 border-t border-[#ffffff]/5 text-center text-[#DCCBC4]/40 font-[family-name:var(--font-nunito)] font-bold text-sm">
            <p>&copy; {new Date().getFullYear()} CatCat. Conçu avec passion dans le cadre d'Epitech.</p>
        </footer>

      </main>
  );
}