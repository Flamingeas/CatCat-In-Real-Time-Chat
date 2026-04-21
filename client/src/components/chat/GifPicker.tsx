"use client";

import { useMemo, useState } from "react";
import { Grid } from "@giphy/react-components";
import { GiphyFetch } from "@giphy/js-fetch-api";

interface GifPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectGif: (gifUrl: string) => void;
}

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "ENOkgZEpFQKApnReETozPZEGXXeJUQ4l";
const GIF_CATEGORIES = ["Tendances", "Réactions", "Mèmes", "Anime", "Fail"];

export function GifPicker({ isOpen, onClose, onSelectGif }: GifPickerProps) {
    const [gifSearch, setGifSearch] = useState("");
    const giphy = useMemo(() => new GiphyFetch(GIPHY_API_KEY), []);

    if (!isOpen) return null;

    async function fetchGifs(offset: number) {
        const query = gifSearch.trim();
        if (query) return giphy.search(query, { offset, limit: 21 });
        return giphy.trending({ offset, limit: 21 });
    }

    return (
        <div className="absolute bottom-full left-0 mb-4 z-[9999] bg-[#0F0908] rounded-xl border border-[#ffffff]/10 shadow-2xl w-[320px] flex flex-col overflow-hidden">
            <div className="p-2 border-b border-[#ffffff]/5">
                <input
                    type="text"
                    placeholder="Rechercher un GIF..."
                    value={gifSearch}
                    onChange={(event) => setGifSearch(event.target.value)}
                    className="w-full bg-[#1E1211] text-sm text-[#DCCBC4] rounded-lg px-3 py-2 border border-[#ffffff]/5 focus:outline-none focus:border-[#EB5E28] transition-colors"
                />
            </div>

            <div className="flex gap-2 p-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                {GIF_CATEGORIES.map((category) => {
                    const isTrending = category === "Tendances";
                    const active = (isTrending && gifSearch === "") || gifSearch === category;

                    return (
                        <button
                            key={category}
                            type="button"
                            onClick={() => setGifSearch(isTrending ? "" : category)}
                            className={[
                                "text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-[#ffffff]/5 cursor-pointer",
                                active
                                    ? "bg-[#EB5E28] text-[#1E1211]"
                                    : "bg-[#1E1211] hover:bg-[#ffffff]/10 text-[#DCCBC4]/70 hover:text-white",
                            ].join(" ")}
                        >
                            {category}
                        </button>
                    );
                })}
            </div>

            <div className="h-[280px] overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                <Grid
                    key={gifSearch}
                    width={300}
                    columns={3}
                    gutter={4}
                    borderRadius={6}
                    fetchGifs={fetchGifs}
                    noResultsMessage={<div className="text-center text-sm text-[#DCCBC4]/50 mt-4">Aucun GIF trouvé</div>}
                    onGifClick={(gif, event) => {
                        event.preventDefault();
                        onSelectGif(gif.images.original.url);
                        setGifSearch("");
                        onClose();
                    }}
                />
            </div>
        </div>
    );
}
