import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebSocketProvider } from "@/lib/WebSocketProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
