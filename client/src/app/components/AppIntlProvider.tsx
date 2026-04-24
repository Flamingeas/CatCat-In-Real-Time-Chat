"use client";

import { NextIntlClientProvider } from "next-intl";
import { ReactNode, useEffect, useMemo, useState } from "react";

import componentMessagesEn from "./en.json";
import componentMessagesFr from "./fr.json";
import chatMessagesEn from "../chat/en.json";
import chatMessagesFr from "../chat/fr.json";

const messages = {
  en: {
    ...componentMessagesEn,
    ...chatMessagesEn,
  },
  fr: {
    ...componentMessagesFr,
    ...chatMessagesFr,
  },
};

type Locale = keyof typeof messages;

function getClientLocale(): Locale {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match?.[1] === "en" ? "en" : "fr";
}

export function AppIntlProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");

  useEffect(() => {
    const syncLocale = () => setLocale(getClientLocale());

    syncLocale();
    window.addEventListener("localechange", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("localechange", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const currentMessages = useMemo(() => messages[locale], [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={currentMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
