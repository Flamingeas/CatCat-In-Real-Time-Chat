"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import { useRouter } from "next/navigation";

import AuthModal from "../components/AuthModal";

import heroImage from "../images/catcat_illustration_hero.png";
import logoImage from "../images/logo_catcat.svg";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

const TypoGraphica = localFont({
  src: "./fonts/TypoGraphica_demo.woff",
  variable: "--font-typographica",
  display: "swap",
});

const Cocogoose = localFont({
  src: "./fonts/Cocogoose-Pro-Regular-trial.ttf",
  variable: "--font-cocogoose",
  display: "swap",
});


const Salks = localFont({
  src: "./fonts/Salks.woff",
  variable: "--font-salks",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: "400",
});

const Dunkin = localFont({
  src: "./fonts/Dunkin.woff",
  variable: "--font-dunkin",
  weight: "400",
});

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

  function refreshAuthState() {
    setIsAuthed(!!getToken());
  }

  useEffect(() => {
    refreshAuthState();
  }, []);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === "access_token") refreshAuthState();
    }
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
      clearAuth();
      setIsAuthed(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
      <main
          className={`min-h-[100dvh] relative bg-[#1E1211] text-[#FFF8F0] ${nunito.variable} ${Cocogoose.variable} ${TypoGraphica.variable} ${Dunkin.variable} ${Salks.variable} font-sans overflow-y-auto lg:overflow-hidden selection:bg-[#FF7F50] selection:text-white`}
      >
        <AuthModal isOpen={isModalOpen} onClose={closeAuthModal} />
        <nav className="relative z-30 w-full px-4 md:px-6 py-6 flex justify-center sm:justify-between items-center h-[100px]">
          <div className="flex items-center gap-3 group cursor-[url('/paw.png'),_pointer] transition-transform duration-300 ease-in-out hover:scale-110">
            <div className="relative w-12 h-12 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12">
              <Image src={logoImage} alt="Logo CatCat" fill className="object-contain" />
            </div>
            <span className="font-[family-name:var(--font-dunkin)] text-3xl pt-1 text-[#FFF8F0] transition-colors duration-300 group-hover:text-[#FF7F50]">
            CatCat
          </span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            {!isAuthed ? (
                <button
                    onClick={openAuthModal}
                    className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-l hover:text-[#FF7F50] transition-colors"
                >
                  Connexion / Inscription
                </button>
            ) : (
                <button
                    onClick={goChat}
                    className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-l hover:text-[#FF7F50] transition-colors"
                >
                  Aller au chat
                </button>
            )}
            {isAuthed && (
                <button
                    onClick={logout}
                    className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-2 font-[family-name:var(--font-cocogoose)] text-l text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                >
                  Se déconnecter
                </button>
            )}
          </div>
        </nav>
        <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[60px] z-10 pointer-events-none lg:hidden"
        ></div>
        <div
            className="relative z-20 container mx-auto px-6 lg:px-12 h-[calc(100vh-100px)] flex flex-col justify-center items-center lg:items-start"
        >
          <div className="w-full lg:max-w-[50%] space-y-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <h1 className="font-[family-name:var(--font-typographica)] text-4xl md:text-5xl lg:text-6xl leading-[1.1] text-[#E89E68]">
              Le coin le plus <span className="text-[#FF7F50]">chill </span> d&apos;Internet.
            </h1>

            <div className="w-16 h-2 bg-[#E89E68] rounded-full"></div>

            <p className="font-[family-name:var(--font-nunito)] font-bold text-lg md:text-xl text-[#DCCBC4] leading-relaxed lg:pr-4">
              Loin du bruit et de l&apos;agitation des réseaux classiques. CatCat est un espace pensé pour
              la discussion, le partage authentique et la créativité. Prenez le temps, connectez-vous
              avec ceux qui vous inspirent et sentez-vous enfin chez vous.
            </p>

            {!isAuthed ? (
                <button
                    onClick={openAuthModal}
                    className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-2 font-[family-name:var(--font-cocogoose)] text-l text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                >
                  Connexion / Inscription
                </button>
            ) : (
                <button
                    onClick={goChat}
                    className="cursor-pointer group relative inline-flex items-center justify-center px-6 py-2 font-[family-name:var(--font-salks)] text-xl text-[#3E1C0A] transition-all duration-200 bg-[#EB5E28] rounded-full hover:bg-[#ffffff] hover:scale-105 shadow-[0_0_20px_rgba(255,127,80,0.3)] hover:shadow-[0_0_30px_rgba(255,127,80,0.5)]"
                >
                  Aller au chat
                </button>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 right-0 h-full w-[160%] lg:w-[65%] z-0 pointer-events-none">
          <Image
              src={heroImage}
              alt="Illustration Hero CatCat"
              fill
              priority
              className="object-cover object-center lg:object-contain lg:object-bottom-right drop-shadow-2xl"
              sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </main>
  );
}