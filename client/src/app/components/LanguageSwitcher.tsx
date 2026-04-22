"use client";
import { useRouter } from "next/navigation";

function getCurrentLocale(): string {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match ? match[1] : "fr";
}

export default function LanguageSwitcher() {
  const router = useRouter();
  function switchLocale() {
    const current = getCurrentLocale();
    const next = current === "fr" ? "en" : "fr";
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  const current = getCurrentLocale();
  return (
    <button
      onClick={switchLocale}
      className="cursor-pointer font-[family-name:var(--font-cocogoose)] text-sm border border-[#FF7F50] text-[#FF7F50] rounded-full px-3 py-1 hover:bg-[#FF7F50] hover:text-[#1E1211] transition-colors"
    >
      {current === "fr" ? "EN" : "FR"}
    </button>
  );
}
