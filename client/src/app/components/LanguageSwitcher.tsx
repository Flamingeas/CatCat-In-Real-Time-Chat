"use client";
import { useState, useEffect } from "react";

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<string>("fr");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
    setLocale(match ? match[1] : "fr");
  }, []);

  function switchLocale() {
    const next = locale === "fr" ? "en" : "fr";
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    window.location.reload();
  }

  return (
    <button
      onClick={switchLocale}
      className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-sm border border-[#FF7F50] text-[#FF7F50] rounded-full px-3 py-1 hover:bg-[#FF7F50] hover:text-[#1E1211] transition-colors"
    >
      {locale === "fr" ? "EN" : "FR"}
    </button>
  );
}
