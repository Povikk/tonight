"use client";

import { useEffect, useState } from "react";
import { completeOnboarding, getSettings } from "@/storage";
import { useHydrated } from "@/hooks/useLocalStore";
import { TonightLogo } from "./TonightLogo";
import { TonightButton } from "./ui";

/**
 * Premier lancement (§69) : deux phrases, un bouton. Pas de tutoriel interminable.
 */
export function FirstLaunchOverlay() {
  const hydrated = useHydrated();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!getSettings().onboarded) setVisible(true);
  }, [hydrated]);

  if (!visible) return null;

  const start = () => {
    completeOnboarding();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-launch-title"
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/95 px-5 backdrop-blur-xl"
    >
      <div className="t-aurora opacity-70" aria-hidden />
      <div className="relative w-full max-w-lg space-y-6 text-center">
        <TonightLogo size="xl" asLink={false} />
        <h1 id="first-launch-title" className="font-display text-xl font-semibold text-chalk sm:text-2xl">
          Moins de choix. Plus de soirées.
        </h1>
        <p className="text-sm text-muted sm:text-base">
          Dis-moi ce que tu veux regarder ce soir, je te propose <strong className="text-chalk">un seul</strong>{" "}
          programme. Tes goûts restent sur cet appareil.
        </p>
        <div>
          <TonightButton size="lg" onClick={start}>
            COMMENCER
          </TonightButton>
        </div>
      </div>
    </div>
  );
}
