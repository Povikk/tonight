import type { PreferencesSource, TonightSearchPreferences } from "@/types/tonight";

/** Préférences qui deviennent la référence de session pour une recherche. */
export function resolveSearchPreferences(
  current: TonightSearchPreferences,
  override?: TonightSearchPreferences,
  source?: PreferencesSource,
): TonightSearchPreferences {
  const target = override ?? current;
  return source && source !== target.source ? { ...target, source } : target;
}
