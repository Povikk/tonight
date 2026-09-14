import { QuestionnaireRunner } from "@/components/flow/QuestionnaireRunner";
import { SERIES_QUESTIONNAIRE } from "@/data/questionnaires";

export const metadata = {
  title: "Choisir une série",
  description: "Engagement, format des épisodes, statut : le parcours série de TONIGHT.",
};

/** Parcours SÉRIE (§23 → §30). Volontairement différent du parcours film. */
export default function SeriePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Parcours série</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">
          {SERIES_QUESTIONNAIRE.title}
        </h1>
        <p className="max-w-xl text-sm text-muted">{SERIES_QUESTIONNAIRE.intro}</p>
      </header>
      <QuestionnaireRunner questionnaire={SERIES_QUESTIONNAIRE} />
    </div>
  );
}
