"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function getClientLocale() {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match ? match[1] : "fr";
}

export default function LanguageSwitcher() {
  const router = useRouter();
  const [locale, setLocale] = useState<string>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocale(getClientLocale());
    setMounted(true);
  }, []);

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    setLocale(newLocale); 
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
    router.refresh(); 
  }

  if (!mounted) return <div className="w-[100px] h-10"></div>;

  return (
    <div className="flex items-center p-1 bg-[#0F0908]/80 border border-[#ffffff]/10 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)] backdrop-blur-sm">
      
      {/* Bouton Français */}
      <button
        onClick={() => switchLocale("fr")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all duration-300 cursor-pointer ${
          locale === "fr"
            ? "bg-[#EB5E28] text-[#1E1211] shadow-[0_0_10px_rgba(235,94,40,0.4)]"
            : "text-[#DCCBC4]/70 hover:text-[#FFF8F0] hover:bg-[#ffffff]/5"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 shadow-sm border border-black/10">
          <rect width="170.6" height="512" fill="#002654"/>
          <rect x="170.6" width="170.6" height="512" fill="#ffffff"/>
          <rect x="341.3" width="170.6" height="512" fill="#ed2939"/>
        </svg>
        <span className="hidden sm:inline font-[family-name:var(--font-cocogoose)] mt-0.5">FR</span>
      </button>

      {/* Bouton Anglais */}
      <button
        onClick={() => switchLocale("en")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all duration-300 cursor-pointer ${
          locale === "en"
            ? "bg-[#EB5E28] text-[#1E1211] shadow-[0_0_10px_rgba(235,94,40,0.4)]"
            : "text-[#DCCBC4]/70 hover:text-[#FFF8F0] hover:bg-[#ffffff]/5"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 shadow-sm border border-black/10">
          <rect width="512" height="512" fill="#012169"/>
          <path d="M0,0 L512,512 M512,0 L0,512" stroke="#ffffff" strokeWidth="60"/>
          <path d="M0,0 L512,512 M512,0 L0,512" stroke="#C8102E" strokeWidth="40"/>
          <path d="M256,0 L256,512 M0,256 L512,256" stroke="#ffffff" strokeWidth="100"/>
          <path d="M256,0 L256,512 M0,256 L512,256" stroke="#C8102E" strokeWidth="60"/>
        </svg>
        <span className="hidden sm:inline font-[family-name:var(--font-cocogoose)] mt-0.5">EN</span>
      </button>

    </div>
  );
}