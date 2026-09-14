"use client";

import { useState } from "react";
import { localDataFootprint, settingsStore, clearAllData, exportLocalData } from "@/storage";
import { providerName } from "@/utils/providers";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useHydrated } from "@/hooks/useLocalStore";
import { useTonight } from "@/components/providers/TonightProvider";
import { SectionTitle, TonightButton } from "@/components/ui";

/**
 * Réglages (§68) : transparence sur les données locales, plateformes
 * mémorisées, et suppression totale.
 */
export default function ReglagesPage() {
  const hydrated = useHydrated();
  const { value: settings } = useLocalStore(settingsStore);
  const { mode } = useTonight();
  const [message, setMessage] = useState<string | null>(null);

  const download = () => {
    const payload = exportLocalData();
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tonight-mes-donnees.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Export téléchargé. Ce fichier contient tout ce que TONIGHT sait de toi.");
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Réglages</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">Tes données, tes règles</h1>
        <p className="text-sm text-muted">
          « Tes préférences restent sur cet appareil. » Aucun compte, aucun serveur de profilage, aucune
          analytics.
        </p>
      </header>

      <section aria-labelledby="privacy">
        <SectionTitle id="privacy">Confidentialité</SectionTitle>
        <ul className="space-y-2 text-sm text-muted">
          <li>
            • Historique, favoris, refus et goûts sont stockés dans le <code>localStorage</code> de ce
            navigateur.
          </li>
          <li>
            • Le token TMDB n'est jamais exposé au navigateur : les appels passent par les routes serveur de
            TONIGHT.
          </li>
          <li>
            • Quand un scoring est demandé, ton profil est envoyé à l'API de cette application, puis oublié.
            Rien n'est conservé côté serveur.
          </li>
        </ul>
      </section>

      <section aria-labelledby="mode">
        <SectionTitle id="mode">Source de données</SectionTitle>
        <p className="text-sm text-muted">
          {mode === "tmdb"
            ? "TMDB est connecté : catalogue complet, affiches et plateformes en temps réel."
            : "Mode démo : aucun token TMDB détecté. Renseigne TMDB_API_KEY ou TMDB_READ_ACCESS_TOKEN dans .env.local puis redémarre l'application."}
        </p>
      </section>

      <section aria-labelledby="providers">
        <SectionTitle id="providers">Plateformes mémorisées</SectionTitle>
        {hydrated && settings.defaultProviders.length ? (
          <ul className="flex flex-wrap gap-2">
            {settings.defaultProviders.map((id) => (
              <li key={id} className="t-chip">
                🎟️ {providerName(id)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-dim">
            Aucune plateforme mémorisée. Choisis-en dans un questionnaire et je m'en souviendrai.
          </p>
        )}
        <div className="mt-4">
          <TonightButton
            variant="ghost"
            size="sm"
            onClick={() => settingsStore.set((previous) => ({ ...previous, defaultProviders: [], defaultMonetization: [] }))}
          >
            Oublier mes plateformes
          </TonightButton>
        </div>
      </section>

      <section aria-labelledby="data" className="t-panel space-y-4 p-5">
        <h2 id="data" className="font-display text-base font-semibold text-chalk">
          Mes données locales
        </h2>
        <p className="text-sm text-muted">
          Environ {hydrated ? Math.round(localDataFootprint() / 1024) : 0} Ko utilisés sur cet appareil.
        </p>
        <div className="flex flex-wrap gap-3">
          <TonightButton variant="soft" onClick={download}>
            ⬇️ Exporter mes données
          </TonightButton>
          <TonightButton
            variant="danger"
            onClick={() => {
              clearAllData();
              setMessage("Tout est effacé. TONIGHT repart comme au premier lancement.");
            }}
          >
            SUPPRIMER MES DONNÉES LOCALES
          </TonightButton>
        </div>
        {message ? <p className="text-sm text-good">{message}</p> : null}
      </section>
    </div>
  );
}
