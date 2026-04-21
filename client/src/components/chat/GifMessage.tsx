"use client";

interface GifMessageProps {
    src: string;
}

export function GifMessage({ src }: GifMessageProps) {
    return (
        // Animated GIFs should start immediately, even inside the chat scroll containers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src.trim()}
            alt="GIF"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="block max-h-[280px] max-w-[280px] rounded-xl object-cover"
        />
    );
}
