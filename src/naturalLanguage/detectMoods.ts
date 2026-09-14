/**
 * Détection des moods.
 *
 * Un mood est une intention, pas un genre : « pas prise de tête » pénalise les
 * films cérébraux, « truc vraiment beau visuellement » active la préférence
 * esthétique, « pas triste » pénalise les contenus lourds.
 */

import { NEGATIVE_MOOD_IDS, POSITIVE_MOOD_DEFINITIONS } from "@/data/moods";
import type { Mood } from "@/types/tonight";
import { moodPhrases } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { MoodDetection, TextContext } from "./types";

export function detectMoods(context: TextContext): MoodDetection {
  const moods: Mood[] = [];
  const excluded: Mood[] = [];
  const evidence: string[] = [];

  const allIds: Mood[] = [...POSITIVE_MOOD_DEFINITIONS.map((definition) => definition.id), ...NEGATIVE_MOOD_IDS];

  for (const mood of allIds) {
    const phrases = moodPhrases(mood);
    const matches = selectNonOverlapping(phrases.flatMap((phrase) => findPhrase(context, phrase)));
    const isNegativeMood = NEGATIVE_MOOD_IDS.includes(mood);

    for (const match of matches) {
      const state = negationState(match);
      if (state === "neutralized") continue;
      evidence.push(state === "affirmed" ? match.phrase : `${state === "attenuated" ? "pas trop " : "pas "}${match.phrase}`);

      if (state === "affirmed") {
        // « je veux un truc triste » → mood négatif assumé et souhaité.
        if (!moods.includes(mood)) moods.push(mood);
      } else {
        // Négation stricte OU atténuée → pénalité sur ce mood.
        if (!excluded.includes(mood)) excluded.push(mood);
      }
    }
  }

  // Un mood nié ne peut pas être souhaité simultanément.
  const filteredMoods = moods.filter((mood) => !excluded.includes(mood));

  // Clarification utile : « pas triste » implique aussi d'éviter les contenus
  // déprimants très marqués (§12), et « pas prise de tête » d'éviter le cérébral.
  const imply = (from: Mood, to: Mood) => {
    if (filteredMoods.includes(from) && !excluded.includes(to)) excluded.push(to);
  };
  imply("sad", "heavy");
  imply("sad", "dark");
  imply("heavy", "dark");

  return {
    value: filteredMoods,
    excluded,
    evidence: [...new Set(evidence)],
    confidence: evidence.length ? 0.85 : 0,
    explicit: evidence.length > 0,
  };
}
