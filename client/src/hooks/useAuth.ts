import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");
        if (!token || !storedUser) {
            router.replace("/");
            return;
        }
        try {
            const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                router.replace("/");
                return;
            }
        } catch {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            router.replace("/");
            return;
        }
        window.setTimeout(() => setHasCheckedAuth(true), 0);
    }, [router]);

    return { hasCheckedAuth };
}
