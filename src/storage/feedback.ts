/**
 * Feedback de refus (§43).
 *
 * Quand l'utilisateur dit « pas envie », on peut lui demander ce qui ne va pas.
 * Ces raisons ajustent IMMÉDIATEMENT les propositions suivantes et nourrissent
 * les goûts à long terme.
 */

import type { MediaType, RefusalFeedback, RefusalReason } from "@/types/tonight";
import { STORAGE_KEYS, storageKey } from "./storageVersion";
import { createLocalStore } from "./safeStorage";

/** Nombre de feedbacks conservés (les plus récents pèsent le plus). */
const MAX_FEEDBACK = 40;

function migrate(raw: unknown): RefusalFeedback[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Partial<RefusalFeedback> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      candidateId: Number(entry.candidateId ?? 0),
      mediaType: (entry.mediaType === "tv" ? "tv" : "movie") as MediaType,
      title: String(entry.title ?? ""),
      reasons: (Array.isArray(entry.reasons) ? entry.reasons : []) as RefusalReason[],
      at: String(entry.at ?? new Date().toISOString()),
    }));
}

export const feedbackStore = createLocalStore<RefusalFeedback[]>(
  storageKey(STORAGE_KEYS.feedback),
  [],
  { migrate },
);

export function addFeedback(entry: Omit<RefusalFeedback, "at">): void {
  feedbackStore.set((previous) =>
    [{ ...entry, at: new Date().toISOString() }, ...previous].slice(0, MAX_FEEDBACK),
  );
}

export function getFeedback(): RefusalFeedback[] {
  return feedbackStore.get();
}

export function clearFeedback(): void {
  feedbackStore.reset();
}

/** Statistiques pour la page « Mes goûts ». */
export function feedbackSummary(): Record<RefusalReason, number> {
  const summary = {} as Record<RefusalReason, number>;
  for (const entry of feedbackStore.get()) {
    for (const reason of entry.reasons) {
      summary[reason] = (summary[reason] ?? 0) + 1;
    }
  }
  return summary;
}
