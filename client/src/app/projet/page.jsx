"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Nunito, Fredoka } from "next/font/google";
import { useRouter } from "next/navigation";
import { 
    MessageSquare, LogOut, Sparkles, GraduationCap, 
    Terminal, Zap, ShieldCheck, Laptop, Users
} from "lucide-react";

import AuthModal from "../components/AuthModal";
import logoImage from "../images/logo_catcat.svg"; 

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

export default function ProjetPage() {
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
            <Link href="/projet" className="px-5 py-2 rounded-full text-[#1E1211] bg-[#EB5E28] transition-all duration-300 cursor-pointer">
              Le Projet
            </Link>
            <Link href="/download" className="px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
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

        {/* === HEADER & LAPTOP MOCKUP === */}
        <section className="pt-[140px] pb-20 px-6 md:px-12 flex flex-col items-center text-center relative overflow-hidden bg-[#0F0908]">
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full max-w-4xl h-[300px] bg-[#FF7F50]/15 blur-[120px] rounded-full pointer-events-none" />

            <h1 className="relative z-10 font-[family-name:var(--font-fredoka)] font-bold text-5xl md:text-7xl leading-[1.1] text-[#FFF8F0] mb-6">
                Construit avec <span className="text-[#FF7F50]">passion.</span>
            </h1>
            <p className="relative z-10 font-[family-name:var(--font-nunito)] text-lg text-[#DCCBC4]/80 max-w-2xl mb-16">
                Découvre les coulisses de CatCat, un projet ambitieux alliant technologies modernes, performances en temps réel et un design pensé pour les communautés.
            </p>

            {/* Mockup Laptop */}
            <div className="relative z-10 w-full max-w-5xl mx-auto drop-shadow-2xl">
                <div className="w-full bg-[#1A1A1A] rounded-t-3xl border-t-[12px] border-l-[12px] border-r-[12px] border-[#2A2A2A] aspect-[16/10] relative overflow-hidden flex items-center justify-center group">
                    <div className="absolute inset-0 bg-[#0a0605] flex flex-col items-center justify-center">
                        <Laptop className="w-24 h-24 text-[#333333] mb-4 group-hover:scale-110 group-hover:text-[#FF7F50] transition-all duration-500" />
                        <p className="font-[family-name:var(--font-cocogoose)] text-[#DCCBC4]/40 tracking-widest text-sm">MOCKUP LAPTOP ICI</p>
                    </div>
                </div>
                <div className="w-[105%] h-6 md:h-8 bg-[#333333] -ml-[2.5%] rounded-b-xl border-t border-[#444444] shadow-2xl relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-[#1A1A1A] rounded-b-md" />
                </div>
            </div>
        </section>

        {/* === L'ÉQUIPE (Déplacé ici) === */}
        <section className="py-24 px-6 md:px-12 bg-[#1E1211] border-t border-[#ffffff]/5">
            <div className="max-w-6xl mx-auto text-center">
                <Users className="w-12 h-12 text-[#FF7F50] mx-auto mb-6" />
                <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl text-[#FFF8F0] mb-16">
                    L'Équipe
                </h2>
                
                <div className="flex flex-wrap justify-center gap-12">
                    {/* Membre 1 */}
                    <div className="flex flex-col items-center group">
                        <div className="w-32 h-32 bg-[#0F0908] rounded-full mb-6 border-2 border-[#ffffff]/10 group-hover:border-[#FF7F50] overflow-hidden transition-colors flex items-center justify-center shadow-lg">
                            <span className="font-[family-name:var(--font-cocogoose)] text-[#DCCBC4]/30 text-xl">Photo</span>
                        </div>
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-1">Ceylian</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#FF7F50] text-sm font-bold">Développeur Fullstack</p>
                    </div>
                    
                    {/* Membre 2 */}
                    <div className="flex flex-col items-center group">
                        <div className="w-32 h-32 bg-[#0F0908] rounded-full mb-6 border-2 border-[#ffffff]/10 group-hover:border-[#FF7F50] overflow-hidden transition-colors flex items-center justify-center shadow-lg">
                            <span className="font-[family-name:var(--font-cocogoose)] text-[#DCCBC4]/30 text-xl">Photo</span>
                        </div>
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-1">Membre 2</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#FF7F50] text-sm font-bold">Rôle Epitech</p>
                    </div>

                     {/* Membre 3 */}
                     <div className="flex flex-col items-center group">
                        <div className="w-32 h-32 bg-[#0F0908] rounded-full mb-6 border-2 border-[#ffffff]/10 group-hover:border-[#FF7F50] overflow-hidden transition-colors flex items-center justify-center shadow-lg">
                            <span className="font-[family-name:var(--font-cocogoose)] text-[#DCCBC4]/30 text-xl">Photo</span>
                        </div>
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-1">Membre 3</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#FF7F50] text-sm font-bold">Rôle Epitech</p>
                    </div>
                </div>
            </div>
        </section>

        {/* === FONCTIONNALITÉS CLES (Grid) === */}
        <section className="py-24 px-6 md:px-12 bg-[#0F0908]">
            <div className="max-w-6xl mx-auto">
                <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl text-center text-[#FFF8F0] mb-16">
                    L'architecture sous le capot
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-[#1E1211] p-8 rounded-3xl border border-[#ffffff]/5 hover:border-[#FF7F50]/30 transition-colors group">
                        <Terminal className="w-10 h-10 text-[#FF7F50] mb-6 group-hover:scale-110 transition-transform" />
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-4">Backend en Rust</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#DCCBC4]/70">
                            Performances inégalées, sécurité de la mémoire et gestion de milliers de connexions simultanées grâce à l'écosystème Rust.
                        </p>
                    </div>
                    <div className="bg-[#1E1211] p-8 rounded-3xl border border-[#ffffff]/5 hover:border-[#FF7F50]/30 transition-colors group">
                        <Zap className="w-10 h-10 text-[#FF7F50] mb-6 group-hover:scale-110 transition-transform" />
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-4">Temps Réel</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#DCCBC4]/70">
                            Intégration poussée des WebSockets pour une distribution instantanée des messages, des frappes et des statuts en ligne.
                        </p>
                    </div>
                    <div className="bg-[#1E1211] p-8 rounded-3xl border border-[#ffffff]/5 hover:border-[#FF7F50]/30 transition-colors group">
                        <ShieldCheck className="w-10 h-10 text-[#FF7F50] mb-6 group-hover:scale-110 transition-transform" />
                        <h3 className="font-[family-name:var(--font-cocogoose)] text-xl text-white mb-4">Sécurité & Auth</h3>
                        <p className="font-[family-name:var(--font-nunito)] text-[#DCCBC4]/70">
                            Mots de passe hashés, tokens JWT sécurisés et gestion stricte des permissions et rôles (Owner, Admin, Banni).
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* === TIMELINE === */}
        <section className="py-24 px-6 md:px-12 bg-[#1E1211]">
            <div className="max-w-4xl mx-auto">
                <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl text-center text-[#E89E68] mb-16">
                    L'évolution du projet
                </h2>
                
                <div className="relative border-l-2 border-[#ffffff]/10 ml-4 md:ml-1/2 space-y-12 pb-8">
                    <div className="relative pl-10 md:pl-0">
                        <div className="md:absolute md:left-[-11px] top-1 bg-[#FF7F50] w-6 h-6 rounded-full border-4 border-[#1E1211] shadow-[0_0_15px_rgba(255,127,80,0.5)] z-10 hidden md:block" />
                        <div className="absolute left-[-11px] top-1 bg-[#FF7F50] w-6 h-6 rounded-full border-4 border-[#1E1211] md:hidden" />
                        <div className="md:ml-12 bg-[#0F0908] p-6 rounded-2xl border border-[#ffffff]/5">
                            <span className="text-xs font-bold text-[#FF7F50] tracking-widest uppercase mb-2 block font-[family-name:var(--font-cocogoose)]">Phase 1</span>
                            <h3 className="text-xl font-bold text-white mb-2 font-[family-name:var(--font-nunito)]">Conception & Fondations</h3>
                            <p className="text-[#DCCBC4]/70 font-[family-name:var(--font-nunito)]">Mise en place de l'architecture base de données (PostgreSQL), création des API RESTful en Rust et design du système de design (Figma).</p>
                        </div>
                    </div>
                    <div className="relative pl-10 md:pl-0">
                        <div className="md:absolute md:left-[-11px] top-1 bg-[#EB5E28] w-6 h-6 rounded-full border-4 border-[#1E1211] shadow-[0_0_15px_rgba(235,94,40,0.5)] z-10 hidden md:block" />
                        <div className="absolute left-[-11px] top-1 bg-[#EB5E28] w-6 h-6 rounded-full border-4 border-[#1E1211] md:hidden" />
                        <div className="md:ml-12 bg-[#0F0908] p-6 rounded-2xl border border-[#ffffff]/5">
                            <span className="text-xs font-bold text-[#EB5E28] tracking-widest uppercase mb-2 block font-[family-name:var(--font-cocogoose)]">Phase 2</span>
                            <h3 className="text-xl font-bold text-white mb-2 font-[family-name:var(--font-nunito)]">Le Cœur du Réacteur</h3>
                            <p className="text-[#DCCBC4]/70 font-[family-name:var(--font-nunito)]">Développement des WebSockets, envois de messages en temps réel, création de serveurs/salons et système de connexion.</p>
                        </div>
                    </div>
                    <div className="relative pl-10 md:pl-0">
                        <div className="md:absolute md:left-[-11px] top-1 bg-[#ffffff]/20 w-6 h-6 rounded-full border-4 border-[#1E1211] z-10 hidden md:block" />
                        <div className="absolute left-[-11px] top-1 bg-[#ffffff]/20 w-6 h-6 rounded-full border-4 border-[#1E1211] md:hidden" />
                        <div className="md:ml-12 bg-[#0F0908] p-6 rounded-2xl border border-[#ffffff]/5 opacity-70 hover:opacity-100 transition-opacity">
                            <span className="text-xs font-bold text-[#DCCBC4]/50 tracking-widest uppercase mb-2 block font-[family-name:var(--font-cocogoose)]">Phase 3 (Actuelle)</span>
                            <h3 className="text-xl font-bold text-white mb-2 font-[family-name:var(--font-nunito)]">Finitions & Expérience</h3>
                            <p className="text-[#DCCBC4]/70 font-[family-name:var(--font-nunito)]">Modération (kick, ban), indicateurs de frappe, emails de bienvenue, paramètres utilisateurs et polissage de l'UI.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* === SECTION EPITECH (Déplacé ici en bas) === */}
        <section className="py-24 px-6 md:px-12 bg-[#0F0908]">
            <div className="max-w-4xl mx-auto text-center">
                <div className="w-20 h-20 mx-auto bg-[#1E1211] rounded-3xl flex items-center justify-center border border-[#ffffff]/10 mb-8 shadow-xl shadow-[#FF7F50]/10">
                    <GraduationCap className="w-10 h-10 text-[#FF7F50]" />
                </div>
                <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl text-[#E89E68] mb-6">
                    Un Projet Epitech
                </h2>
                <div className="w-12 h-1.5 bg-[#FF7F50] rounded-full mx-auto mb-8"></div>
                <p className="font-[family-name:var(--font-nunito)] text-lg text-[#DCCBC4]/90 leading-relaxed">
                    CatCat a été conçu dans le cadre de notre cursus à <strong className="text-white">Epitech</strong>. L'objectif de ce projet était de relever un défi technique majeur : créer une application de chat fonctionnelle, robuste et en temps réel. Nous avons fait le choix de technologies de pointe comme <strong>Rust</strong> pour un backend ultra-performant et <strong>React / Next.js</strong> pour une interface fluide et réactive.
                </p>
            </div>
        </section>

        {/* === FOOTER === */}
        <footer className="relative z-20 bg-[#1E1211] py-8 border-t border-[#ffffff]/5 text-center text-[#DCCBC4]/40 font-[family-name:var(--font-nunito)] font-bold text-sm">
            <p>&copy; {new Date().getFullYear()} CatCat. Conçu avec passion dans le cadre d'Epitech.</p>
        </footer>

      </main>
  );
}