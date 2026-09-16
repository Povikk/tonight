import type { Candidate } from "@/types/tonight";

export function displayedRating(candidate: Candidate): {
  average: number;
  voteCount: number;
  source: "IMDb" | null;
} {
  if (candidate.publicRating?.source === "imdb") {
    return {
      average: candidate.publicRating.average,
      voteCount: candidate.publicRating.voteCount,
      source: "IMDb",
    };
  }
  return { average: candidate.voteAverage, voteCount: candidate.voteCount, source: null };
}
