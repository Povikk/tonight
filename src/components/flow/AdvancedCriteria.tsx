"use client";

import type { MediaType, TonightSearchPreferences } from "@/types/tonight";
import { useCatalogOptions } from "@/hooks/useCatalogOptions";
import { genreName } from "@/utils/constants";

/**
 * « ⚙️ PLUS DE CRITÈRES » (§31).
 * Volontairement à l'écart du parcours principal : ici on est précis, mais rien
 * n'est obligatoire.
 */
export function AdvancedCriteria({
  mediaType,
  value,
  onChange,
}: {
  mediaType: MediaType;
  value: Partial<TonightSearchPreferences>;
  onChange: (patch: Partial<TonightSearchPreferences>) => void;
}) {
  const { genres } = useCatalogOptions(mediaType);

  const toggleGenre = (genreId: number) => {
    const required = value.genres ?? [];
    const excluded = value.excludedGenres ?? [];
    const nextRequired = required.includes(genreId)
      ? required.filter((id) => id !== genreId)
      : [...required, genreId];
    const constraints = new Set(value.hardConstraints ?? []);
    if (nextRequired.length) constraints.add("requireGenre");
    else constraints.delete("requireGenre");
    onChange({
      genres: nextRequired,
      excludedGenres: excluded.filter((id) => id !== genreId),
      hardConstraints: [...constraints],
    });
  };

  const toggleExcluded = (genreId: number) => {
    const excluded = value.excludedGenres ?? [];
    const hardExcluded = value.hardExcludedGenres ?? [];
    const required = value.genres ?? [];
    const removing = excluded.includes(genreId);
    const nextExcluded = removing
      ? excluded.filter((id) => id !== genreId)
      : [...excluded, genreId];
    // La désélection doit retirer l'exclusion DURE, sinon le moteur continue
    // d'écarter le genre alors que l'interface l'affiche comme désactivé.
    const nextHard = removing
      ? hardExcluded.filter((id) => id !== genreId)
      : [...new Set([...hardExcluded, genreId])];
    const constraints = new Set(value.hardConstraints ?? []);
    if (nextExcluded.length) constraints.add("excludeGenres");
    else constraints.delete("excludeGenres");
    onChange({
      excludedGenres: nextExcluded,
      hardExcludedGenres: nextHard,
      genres: required.filter((id) => id !== genreId),
      hardConstraints: [...constraints],
    });
  };

  const addConstraint = (constraint: TonightSearchPreferences["hardConstraints"][number], enabled: boolean) => {
    const current = new Set(value.hardConstraints ?? []);
    if (enabled) current.add(constraint);
    else current.delete(constraint);
    onChange({ hardConstraints: [...current] });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="block text-muted">Langue originale</span>
          <select
            className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
            value={value.originalLanguage ?? ""}
            onChange={(event) => {
              const code = event.target.value || null;
              onChange({ originalLanguage: code });
              addConstraint("originalLanguage", Boolean(code));
            }}
          >
            <option value="">Peu importe</option>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="ja">Japonais</option>
            <option value="ko">Coréen</option>
            <option value="es">Espagnol</option>
            <option value="it">Italien</option>
            <option value="de">Allemand</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="block text-muted">Pays d'origine</span>
          <select
            className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
            value={value.originCountry ?? ""}
            onChange={(event) => {
              const code = event.target.value || null;
              onChange({ originCountry: code });
              addConstraint("originCountry", Boolean(code));
            }}
          >
            <option value="">Peu importe</option>
            <option value="FR">France</option>
            <option value="US">États-Unis</option>
            <option value="GB">Royaume-Uni</option>
            <option value="JP">Japon</option>
            <option value="KR">Corée du Sud</option>
            <option value="ES">Espagne</option>
            <option value="IT">Italie</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="block text-muted">Année minimum</span>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2030}
            className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
            value={value.minYear ?? ""}
            onChange={(event) => {
              const year = event.target.value ? Number(event.target.value) : null;
              onChange({ minYear: year, softRecent: false, softMinYear: null });
              addConstraint("minYear", year !== null);
            }}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="block text-muted">Année maximum</span>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2030}
            className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
            value={value.maxYear ?? ""}
            onChange={(event) => {
              const year = event.target.value ? Number(event.target.value) : null;
              onChange({ maxYear: year, softOld: false, softMaxYear: null });
              addConstraint("maxYear", year !== null);
            }}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="block text-muted">Note minimum (sur 10)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={10}
            className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
            value={value.minRating ?? ""}
            onChange={(event) => {
              const rating = event.target.value ? Number(event.target.value) : null;
              onChange({ minRating: rating });
              addConstraint("minRating", rating !== null);
            }}
          />
        </label>

        {mediaType === "movie" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-sm">
              <span className="block text-muted">Durée min (min)</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
                value={value.minRuntime ?? ""}
                onChange={(event) => {
                  const minutes = event.target.value ? Number(event.target.value) : null;
                  onChange({ minRuntime: minutes });
                  addConstraint("minRuntime", minutes !== null);
                }}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="block text-muted">Durée max (min)</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
                value={value.maxRuntime ?? ""}
                onChange={(event) => {
                  const minutes = event.target.value ? Number(event.target.value) : null;
                  onChange({ maxRuntime: minutes, softMaxRuntime: null });
                  addConstraint("maxRuntime", minutes !== null);
                }}
              />
            </label>
          </div>
        ) : (
          <label className="space-y-1.5 text-sm">
            <span className="block text-muted">Nombre maximum de saisons</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-night-line bg-night/70 px-3 py-2.5 text-chalk"
              value={value.maxSeasons ?? ""}
              onChange={(event) => {
                const seasons = event.target.value ? Number(event.target.value) : null;
                onChange({ maxSeasons: seasons });
                addConstraint("maxSeasons", seasons !== null);
              }}
            />
          </label>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">Exclure des catégories entières</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {(
            [
              ["excludeAnimation", "🚫 Animation"],
              ["excludeDocumentary", "🚫 Documentaires"],
              ["excludeMusical", "🚫 Comédies musicales"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-full border border-night-line px-3 py-1.5">
              <input
                type="checkbox"
                checked={Boolean(value[key])}
                onChange={(event) => {
                  onChange({ [key]: event.target.checked } as Partial<TonightSearchPreferences>);
                  addConstraint(key, event.target.checked);
                }}
                className="size-4 accent-[#7b6cff]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {genres.length ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm text-muted">Genre obligatoire</legend>
            <div className="flex flex-wrap gap-2">
              {genres.slice(0, 18).map((genre) => {
                const active = (value.genres ?? []).includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleGenre(genre.id)}
                    className={`t-chip ${active ? "border-violet bg-violet/20" : "text-muted hover:text-chalk"}`}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm text-muted">Genres exclus</legend>
            <div className="flex flex-wrap gap-2">
              {genres.slice(0, 18).map((genre) => {
                const active = (value.excludedGenres ?? []).includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleExcluded(genre.id)}
                    className={`t-chip ${active ? "border-danger bg-danger/10 text-danger" : "text-muted hover:text-chalk"}`}
                  >
                    {genreName(genre.id)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}
