export function isGifMessage(content: string) {
    const trimmed = content.trim();
    try {
        const url = new URL(trimmed);
        if (url.protocol !== "https:" && url.protocol !== "http:") return false;

        const hostname = url.hostname.toLowerCase();
        const isGiphyHost = hostname === "giphy.com" || hostname.endsWith(".giphy.com");

        return isGiphyHost && url.pathname.includes("/media/");
    } catch {
        return false;
    }
}
