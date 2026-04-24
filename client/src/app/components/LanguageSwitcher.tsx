"use client";
import { useState, useEffect } from "react";

function getClientLocale() {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match ? match[1] : "fr";
}

export default function LanguageSwitcher() {
  const [mounted, setMounted] = useState(false);
  const locale = mounted ? getClientLocale() : "fr";

  // Évite les erreurs d'hydratation
  useEffect(() => {
    setMounted(true);
  }, []);

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
    window.location.reload();
  }

  // Espace réservé pendant le chargement initial pour éviter que la navbar ne saute
  if (!mounted) return <div className="w-[100px] h-10"></div>;

  return (
    <div className="flex items-center p-1 bg-[#0F0908]/80 border border-[#ffffff]/10 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)] backdrop-blur-sm">
      {/* Bouton Français */}
      <button
        onClick={() => switchLocale("fr")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-300 cursor-pointer ${
          locale === "fr"
            ? "bg-[#EB5E28] text-[#1E1211] shadow-[0_0_10px_rgba(235,94,40,0.4)]"
            : "text-[#DCCBC4]/70 hover:text-[#FFF8F0] hover:bg-[#ffffff]/5"
        }`}
      >
        <span className="text-base leading-none">🇫🇷</span>
        <span className="hidden sm:inline font-[family-name:var(--font-cocogoose)] mt-0.5">FR</span>
      </button>

      {/* Bouton Anglais */}
      <button
        onClick={() => switchLocale("en")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-300 cursor-pointer ${
          locale === "en"
            ? "bg-[#EB5E28] text-[#1E1211] shadow-[0_0_10px_rgba(235,94,40,0.4)]"
            : "text-[#DCCBC4]/70 hover:text-[#FFF8F0] hover:bg-[#ffffff]/5"
        }`}
      >
        <span className="text-base leading-none">🇬🇧</span>
        <span className="hidden sm:inline font-[family-name:var(--font-cocogoose)] mt-0.5">EN</span>
      </button>
    </div>
  );
}