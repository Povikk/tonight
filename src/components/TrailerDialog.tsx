"use client";

import { useEffect, useState } from "react";
import type { MediaType, TrailerInfo } from "@/types/tonight";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/utils/trailers";
import { EXTERNAL_LINK_REL } from "@/utils/providers";

interface TrailerPayload {
  title?: string;
  trailer?: TrailerInfo | null;
  error?: string;
}

export function TrailerDialog({
  id,
  mediaType,
  title,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trailer, setTrailer] = useState<TrailerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const mediaKey = `${mediaType}:${id}`;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const showTrailer = async () => {
    setOpen(true);
    if (loadedKey === mediaKey) return;

    setLoading(true);
    setTrailer(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/trailer?mediaType=${encodeURIComponent(mediaType)}&id=${encodeURIComponent(id)}`,
      );
      const payload = (await response.json().catch(() => null)) as TrailerPayload | null;
      if (!response.ok) throw new Error(payload?.error || "Bande-annonce indisponible.");
      setTrailer(payload?.trailer ?? null);
      setLoadedKey(mediaKey);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bande-annonce indisponible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void showTrailer()}
        className="rounded-full border border-night-line px-4 py-2 text-sm text-muted transition-colors hover:border-violet/50 hover:text-chalk"
      >
        ▶ Bande-annonce
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="trailer-dialog-title"
            className="w-full max-w-4xl rounded-3xl border border-night-line bg-night p-4 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-violet-soft">Bande-annonce</p>
                <h2 id="trailer-dialog-title" className="font-display text-xl font-semibold text-chalk">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer la bande-annonce"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-night-line text-muted hover:text-chalk"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-night-line bg-ink text-sm text-muted">
                Je cherche la meilleure bande-annonce…
              </div>
            ) : trailer ? (
              <>
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-night-line bg-ink">
                  <iframe
                    src={youtubeEmbedUrl(trailer.key)}
                    title={`Bande-annonce de ${title}`}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <p className="mt-3 text-xs text-muted-dim">
                  Vidéo fournie par TMDB ·{" "}
                  <a
                    href={youtubeWatchUrl(trailer.key)}
                    target="_blank"
                    rel={EXTERNAL_LINK_REL}
                    className="underline decoration-dotted hover:text-chalk"
                  >
                    Ouvrir sur YouTube
                  </a>
                </p>
              </>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-night-line bg-ink px-6 text-center text-sm text-muted">
                {error ?? "TMDB ne fournit aucune bande-annonce pour ce titre."}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
