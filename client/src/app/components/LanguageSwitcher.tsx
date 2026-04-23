"use client";
import { useState } from "react";

function getClientLocale() {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match ? match[1] : "fr";
}

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<string>(getClientLocale);

  function switchLocale() {
    const next = locale === "fr" ? "en" : "fr";
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    window.location.reload();
  }

  return (
    <button
      onClick={switchLocale}
      suppressHydrationWarning
      className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-sm border border-[#FF7F50] text-[#FF7F50] rounded-full px-3 py-1 hover:bg-[#FF7F50] hover:text-[#1E1211] transition-colors"
    >
      {locale === "fr" ? "EN" : "FR"}
    </button>
  );
}
