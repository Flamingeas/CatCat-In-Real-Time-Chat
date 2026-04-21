export function isGifMessage(content: string) {
    const trimmed = content.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    return /giphy\.com\/media|media\.giphy\.com\/media|i\.giphy\.com/i.test(trimmed) || /\.(gif|webp)(\?.*)?$/i.test(trimmed);
}
