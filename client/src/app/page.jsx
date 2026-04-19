"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Nunito, Fredoka } from "next/font/google";
import { useRouter } from "next/navigation";
import { MessageSquare, Shield, Image as ImageIcon, LogOut, Sparkles } from "lucide-react";

import AuthModal from "../components/AuthModal";

import heroImage from "../images/catcat_illustration_hero.png";
import logoImage from "../images/logo_catcat.svg";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

// --- POLICES ---
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["600", "700"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: "400" });

const TypoGraphica = localFont({ src: "./fonts/TypoGraphica_demo.woff", variable: "--font-typographica", display: "swap" });
const Cocogoose = localFont({ src: "./fonts/Cocogoose-Pro-Regular-trial.ttf", variable: "--font-cocogoose", display: "swap" });
const Salks = localFont({ src: "./fonts/Salks.woff", variable: "--font-salks", display: "swap" });
const Dunkin = localFont({ src: "./fonts/Dunkin.woff", variable: "--font-dunkin", weight: "400" });

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export default function Home() {
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
      <main className={`min-h-[100dvh] relative bg-[#1E1211] text-[#FFF8F0] ${nunito.variable} ${Cocogoose.variable} ${fredoka.variable} ${Dunkin.variable} ${Salks.variable} font-sans selection:bg-[#FF7F50] selection:text-white overflow-x-hidden`}>
        
        <AuthModal isOpen={isModalOpen} onClose={closeAuthModal} />
        
        {/* === NAVBAR (Fixe en haut avec flou) === */}
        <nav className="fixed top-0 left-0 right-0 z-50 h-[auto] min-h-[70px] pt-[env(safe-area-inset-top)] px-4 md:px-8 flex justify-between items-center bg-[#1E1211]/80 backdrop-blur-md">
          
          {/* Logo gauche */}
          <div className="flex items-center gap-2 md:gap-3 group cursor-[url('/paw.png'),_pointer] transition-transform duration-300 ease-in-out hover:scale-105">
            <div className="relative w-8 h-8 md:w-10 md:h-10 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12">
              <Image src={logoImage} alt="Logo CatCat" fill className="object-contain" />
            </div>
            <span className="font-[family-name:var(--font-dunkin)] text-xl md:text-2xl pt-1 text-[#FFF8F0] transition-colors duration-300 group-hover:text-[#FF7F50]">
              CatCat
            </span>
          </div>

          {/* Menu central (Caché sur mobile) */}
          <div className="hidden lg:flex items-center gap-2 font-[family-name:var(--font-cocogoose)] text-base tracking-wide">
            <a href="#features" className="px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
              Présentation
            </a>
            <Link href="/projet" className="px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
              Le Projet
            </Link>
            <Link href="/download" className="px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
              Télécharger
            </Link>
            <Link href="/demo" className="flex items-center gap-2 px-5 py-2 rounded-full text-[#DCCBC4] hover:bg-[#EB5E28] hover:text-[#1E1211] transition-all duration-300 cursor-pointer">
              Démo Interactive
            </Link>
          </div>

          {/* Zone Droite (Bouton Auth ou Avatar) */}
          <div className="flex items-center">
            {!isAuthed ? (
                <button
                    onClick={openAuthModal}
                    // Plus petit sur mobile : px-4 py-2 text-xs, grand sur desktop : md:px-6 md:py-2.5 md:text-base
                    className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-xs md:text-base px-4 py-2 md:px-6 md:py-2.5 text-[#3E1C0A] bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                >
                  <span className="hidden sm:inline">Connexion / Inscription</span>
                  <span className="sm:hidden">Se connecter</span>
                </button>
            ) : (
                <div className="relative group">
                  <button className="w-10 h-10 md:w-12 md:h-12 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs md:text-sm border-2 border-[#1E1211] hover:scale-105 transition-transform shadow-[0_0_15px_rgba(190,242,100,0.3)] cursor-pointer">
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
        
        {/* === SECTION 1 : HERO === */}
        <section className="relative w-full min-h-[100dvh] overflow-hidden flex flex-col pt-[70px] md:pt-[80px]">
          
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[60px] z-10 pointer-events-none lg:hidden"></div>
          
          <div className="relative z-20 container mx-auto px-6 lg:px-12 flex-1 flex flex-col justify-center items-center lg:items-start pb-20">
            <div className="w-full lg:max-w-[50%] space-y-6 md:space-y-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              {/* Texte plus discret sur mobile : text-4xl au lieu de 5xl */}
              <h1 className="font-[family-name:var(--font-fredoka)] font-bold text-4xl md:text-6xl lg:text-7xl leading-[1.1] text-[#E89E68]">
                Le coin le plus <span className="text-[#FF7F50]">chill </span> d&apos;Internet.
              </h1>

              <div className="w-12 md:w-16 h-1.5 md:h-2 bg-[#E89E68] rounded-full"></div>

              {/* Texte plus fin sur mobile : text-base au lieu de text-lg */}
              <p className="font-[family-name:var(--font-nunito)] font-bold text-base md:text-xl text-[#DCCBC4] leading-relaxed lg:pr-4">
                Loin du bruit et de l&apos;agitation des réseaux classiques. CatCat est un espace pensé pour
                la discussion, le partage authentique et la créativité. Prenez le temps, connectez-vous
                avec ceux qui vous inspirent et sentez-vous enfin chez vous.
              </p>

              {!isAuthed ? (
                  <button
                      onClick={openAuthModal}
                      // Bouton moins massif : px-6 py-3 text-base
                      className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-3.5 font-[family-name:var(--font-cocogoose)] text-base md:text-lg text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                  >
                    Connexion / Inscription
                  </button>
              ) : (
                  <button
                      onClick={goChat}
                      className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-3.5 font-[family-name:var(--font-salks)] text-xl md:text-2xl text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                  >
                    Aller au chat
                  </button>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 right-0 h-[90%] w-[160%] lg:w-[65%] z-0 pointer-events-none">
            <Image
                src={heroImage}
                alt="Illustration Hero CatCat"
                fill
                priority
                className="object-cover object-center lg:object-contain lg:object-bottom-right drop-shadow-2xl"
                sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </section>

        {/* === SECTION 2 : PRÉSENTATION DES FONCTIONNALITÉS === */}
        <section id="features" className="relative z-20 py-16 md:py-24 px-6 md:px-12 bg-[#0F0908] border-t border-[#ffffff]/5 scroll-mt-[70px] md:scroll-mt-[80px]">
            <div className="max-w-6xl mx-auto flex flex-col gap-20 md:gap-32">
                
                {/* FEATURE 1 */}
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-20">
                    <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
                        {/* Titre 3xl sur mobile */}
                        <h2 className="text-3xl md:text-5xl lg:text-6xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold leading-[1.1]">
                            Crée un espace <br className="hidden md:block" /> <span className="text-[#FF7F50]">sur mesure</span>
                        </h2>
                        <div className="w-10 md:w-12 h-1 md:h-1.5 bg-[#FF7F50] rounded-full mx-auto md:mx-0"></div>
                        <p className="text-base md:text-lg font-[family-name:var(--font-nunito)] text-[#DCCBC4]/80 leading-relaxed font-bold">
                            Les serveurs CatCat sont organisés en salons thématiques où tu peux collaborer, partager tes passions ou simplement parler de ta journée sans encombrer un groupe de discussion général.
                        </p>
                    </div>
                    <div className="flex-1 w-full">
                        <div className="w-full aspect-[4/3] bg-transparent flex flex-col items-center justify-center text-[#DCCBC4]/30 group transition-all">
                            <ImageIcon className="w-12 h-12 md:w-16 md:h-16 mb-4 group-hover:scale-110 group-hover:text-[#FF7F50] transition-all duration-300" />
                            <span className="font-[family-name:var(--font-cocogoose)] text-xs md:text-sm tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">Illustration Serveurs</span>
                        </div>
                    </div>
                </div>

                {/* FEATURE 2 */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-20">
                    <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
                        <h2 className="text-3xl md:text-5xl lg:text-6xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold leading-[1.1]">
                            Là où se retrouver <br className="hidden md:block" /> devient <span className="text-[#FF7F50]">facile</span>
                        </h2>
                        <div className="w-10 md:w-12 h-1 md:h-1.5 bg-[#FF7F50] rounded-full mx-auto md:mx-0"></div>
                        <p className="text-base md:text-lg font-[family-name:var(--font-nunito)] text-[#DCCBC4]/80 leading-relaxed font-bold">
                            Prends place dans un salon et vois qui est en ligne. L'indicateur de frappe en temps réel et les réactions aux messages rendent chaque conversation vivante et amusante.
                        </p>
                    </div>
                    <div className="flex-1 w-full">
                        <div className="w-full aspect-[4/3] bg-transparent flex flex-col items-center justify-center text-[#DCCBC4]/30 group transition-all">
                            <MessageSquare className="w-12 h-12 md:w-16 md:h-16 mb-4 group-hover:scale-110 group-hover:text-[#FF7F50] transition-all duration-300" />
                            <span className="font-[family-name:var(--font-cocogoose)] text-xs md:text-sm tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">Illustration Chat</span>
                        </div>
                    </div>
                </div>

                {/* FEATURE 3 */}
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-20">
                    <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
                        <h2 className="text-3xl md:text-5xl lg:text-6xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold leading-[1.1]">
                            De quelques amis <br className="hidden md:block" /> à toute une <span className="text-[#FF7F50]">communauté</span>
                        </h2>
                        <div className="w-10 md:w-12 h-1 md:h-1.5 bg-[#FF7F50] rounded-full mx-auto md:mx-0"></div>
                        <p className="text-base md:text-lg font-[family-name:var(--font-nunito)] text-[#DCCBC4]/80 leading-relaxed font-bold">
                            Crée des rôles, gère les permissions et donne des pouvoirs à tes membres. Du système d'invitation à l'exclusion, tu as le contrôle total de ton espace.
                        </p>
                    </div>
                    <div className="flex-1 w-full">
                        <div className="w-full aspect-[4/3] bg-transparent flex flex-col items-center justify-center text-[#DCCBC4]/30 group transition-all">
                            <Shield className="w-12 h-12 md:w-16 md:h-16 mb-4 group-hover:scale-110 group-hover:text-[#FF7F50] transition-all duration-300" />
                            <span className="font-[family-name:var(--font-cocogoose)] text-xs md:text-sm tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">Illustration Modération</span>
                        </div>
                    </div>
                </div>

            </div>
        </section>

        {/* === SECTION 3 : CALL TO ACTION FINAL === */}
        <section className="relative z-20 py-16 md:py-24 px-6 text-center bg-[#0a0605] overflow-hidden border-t border-[#ffffff]/5">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[200px] bg-[#FF7F50]/10 blur-[120px] rounded-full pointer-events-none" />
            <h2 className="text-3xl md:text-5xl text-[#E89E68] font-[family-name:var(--font-fredoka)] font-bold mb-8 md:mb-10">
                Prêt à commencer ton aventure ?
            </h2>
            
            {!isAuthed ? (
                <button
                    onClick={openAuthModal}
                    className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-10 md:py-4 font-[family-name:var(--font-cocogoose)] text-base md:text-xl text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_30px_rgba(255,127,80,0.3)] hover:shadow-[0_0_40px_rgba(255,127,80,0.6)]"
                >
                  Rejoindre CatCat
                </button>
            ) : (
                <button
                    onClick={goChat}
                    className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-3 md:px-10 md:py-4 font-[family-name:var(--font-salks)] text-xl md:text-2xl text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_30px_rgba(255,127,80,0.3)] hover:shadow-[0_0_40px_rgba(255,127,80,0.6)]"
                >
                  Ouvrir l'application
                </button>
            )}
        </section>

        {/* === FOOTER === */}
        <footer className="relative z-20 bg-[#0F0908] py-8 border-t border-[#ffffff]/5 text-center text-[#DCCBC4]/40 font-[family-name:var(--font-nunito)] font-bold text-xs md:text-sm px-4">
            <p>&copy; {new Date().getFullYear()} CatCat. Conçu avec passion et beaucoup de croquettes par l'équipe Epitech.</p>
        </footer>

      </main>
  );
}