import { QuestionnaireRunner } from "@/components/flow/QuestionnaireRunner";
import { MOVIE_QUESTIONNAIRE } from "@/data/questionnaires";

export const metadata = {
  title: "Choisir un film",
  description: "Six questions, gros boutons, une recommandation. Le parcours film de TONIGHT.",
};

/** Parcours FILM (§16 → §22). */
export default function FilmPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Parcours film</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">
          {MOVIE_QUESTIONNAIRE.title}
        </h1>
        <p className="max-w-xl text-sm text-muted">{MOVIE_QUESTIONNAIRE.intro}</p>
      </header>
      <QuestionnaireRunner questionnaire={MOVIE_QUESTIONNAIRE} />
    </div>
  );
}
