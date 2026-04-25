"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getApiBaseUrl } from "@/lib/api-url";

type AuthModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

const API_BASE = getApiBaseUrl();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isValidPassword = (value: string) => value.trim().length >= 8;
const isValidUsername = (value: string) => value.trim().length >= 3;

function getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
}

function setAuthStorage(token: string, user: unknown) {
    localStorage.setItem("access_token", token);
    localStorage.setItem("user", JSON.stringify(user));
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const router = useRouter();
    const t = useTranslations("authModal");

    const [isLogin, setIsLogin] = useState(true);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [touched, setTouched] = useState({
        email: false,
        password: false,
        username: false,
    });

    const emailOk = useMemo(() => isValidEmail(email), [email]);
    const passwordOk = useMemo(() => isValidPassword(password), [password]);
    const usernameOk = useMemo(() => isValidUsername(username), [username]);

    const canSubmit = isLogin ? emailOk && passwordOk : usernameOk && emailOk && passwordOk;

    function resetForm() {
        setEmail("");
        setPassword("");
        setUsername("");
        setErrorMsg(null);
        setLoading(false);
        setTouched({ email: false, password: false, username: false });
    }

    function markAllTouched() {
        setTouched({ email: true, password: true, username: true });
    }

    function toggleMode() {
        setErrorMsg(null);
        setTouched({ email: false, password: false, username: false });
        setIsLogin((v) => !v);
    }

    useEffect(() => {
        if (!isOpen) return;
        resetForm();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const token = getStoredToken();
        if (token) {
            onClose();
            router.replace("/chat");
            router.refresh();
        }
    }, [isOpen, onClose, router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);

        if (!canSubmit) {
            markAllTouched();
            setErrorMsg(t("submit.invalidFields"));
            return;
        }

        try {
            setLoading(true);

            const url = isLogin ? `${API_BASE}/auth/login` : `${API_BASE}/auth/signup`;

            const payload = isLogin
                ? { email: email.trim().toLowerCase(), password }
                : { username: username.trim(), email: email.trim().toLowerCase(), password };

            const { data } = await axios.post(url, payload, {
                headers: { "Content-Type": "application/json" },
            });

            if (!data?.token) {
                throw new Error("Token manquant dans la réponse du backend.");
            }

            setAuthStorage(data.token, data.user);

            onClose();
            router.push("/chat");
            router.refresh();
        } catch (err: any) {
            const apiMsg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Erreur inconnue";
            setErrorMsg(apiMsg);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    const inputBase =
        "w-full bg-[#2A1A18] border rounded-xl px-4 py-3 text-[#FFF8F0] placeholder-[#DCCBC4]/40 focus:outline-none transition-colors";
    const borderOk = "border-[#E89E68]/20 focus:border-[#EB5E28]";
    const borderKo = "border-red-400/60 focus:border-red-400";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md bg-[#1E1211] border border-[#E89E68]/30 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-2 text-[#DCCBC4] hover:text-[#FF7F50] transition-colors z-10 cursor-pointer"
                    aria-label={t("close")}
                    type="button"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-6 h-6"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="text-center mb-8">
                    <h2 className="font-[family-name:var(--font-cocogoose)] text-2xl text-[#E89E68] mb-2">
                        {isLogin ? t("login.title") : t("register.title")}
                    </h2>
                    <p className="text-[#DCCBC4] text-sm font-[family-name:var(--font-nunito)]">
                        {isLogin ? t("login.subtitle") : t("register.subtitle")}
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 font-[family-name:var(--font-nunito)]">
                    {!isLogin && (
                        <div>
                            <input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                                type="text"
                                placeholder={t("fields.username.placeholder")}
                                className={`${inputBase} ${touched.username && !usernameOk ? borderKo : borderOk}`}
                                required
                                minLength={3}
                                autoComplete="username"
                            />
                            {touched.username && !usernameOk && (
                                <p className="mt-1 text-xs text-red-300">{t("fields.username.error")}</p>
                            )}
                        </div>
                    )}
                    <div>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                            type="email"
                            placeholder={t("fields.email.placeholder")}
                            className={`${inputBase} ${touched.email && !emailOk ? borderKo : borderOk}`}
                            required
                            autoComplete="email"
                            inputMode="email"
                        />
                        {touched.email && !emailOk && (
                            <p className="mt-1 text-xs text-red-300">{t("fields.email.error")}</p>
                        )}
                    </div>
                    <div>
                        <input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                            type="password"
                            placeholder={t("fields.password.placeholder")}
                            className={`${inputBase} ${touched.password && !passwordOk ? borderKo : borderOk}`}
                            required
                            minLength={8}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                        />
                        {touched.password && !passwordOk && (
                            <p className="mt-1 text-xs text-red-300">{t("fields.password.error")}</p>
                        )}
                    </div>
                    {errorMsg && (
                        <div className="text-sm text-red-300 bg-red-900/20 border border-red-400/20 rounded-xl p-3">
                            {errorMsg}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading || !canSubmit}
                        className="w-full py-3 bg-[#EB5E28] hover:bg-[#FF7F50] disabled:opacity-60 disabled:cursor-not-allowed text-[#1E1211] font-bold rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
                    >
                        {loading ? t("submit.loading") : isLogin ? t("submit.login") : t("submit.register")}
                    </button>
                </form>
                <div className="mt-6 text-center text-sm text-[#DCCBC4] font-[family-name:var(--font-nunito)]">
                    {isLogin ? t("footer.noAccount") : t("footer.alreadyMember")}
                    <button onClick={toggleMode} className="text-[#FF7F50] hover:underline font-bold cursor-pointer" type="button">
                        {isLogin ? t("footer.signUp") : t("footer.signIn")}
                    </button>
                </div>
            </div>
        </div>
    );
}
