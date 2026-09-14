import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/services/catalog";
import { DetailView } from "@/components/DetailView";
import { EmptyState } from "@/components/ui";

export const revalidate = 86_400;

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Fiche SÉRIE (§50). */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const details = await getCatalog().getDetails("tv", Number(id));
    return {
      title: `${details.title}${details.year ? ` (${details.year})` : ""}`,
      description: details.overview.slice(0, 160) || undefined,
    };
  } catch {
    return { title: "Série introuvable" };
  }
}

export default async function SerieDetailPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <EmptyState
        emoji="📺"
        title="Cette série n'existe pas (encore)."
        description="L'identifiant n'est pas valide."
        action={
          <Link href="/" className="rounded-full bg-chalk px-5 py-2.5 text-sm font-semibold text-ink">
            Retour à l'accueil
          </Link>
        }
      />
    );
  }

  try {
    const details = await getCatalog().getDetails("tv", numericId);
    return <DetailView details={details} />;
  } catch {
    return (
      <EmptyState
        emoji="🌙"
        title="Je n'arrive pas à ouvrir cette fiche."
        description="TMDB ne répond pas, ou cette œuvre n'est plus disponible. Réessaie dans un instant."
        action={
          <Link href="/" className="rounded-full bg-chalk px-5 py-2.5 text-sm font-semibold text-ink">
            Retour à l'accueil
          </Link>
        }
      />
    );
  }
}
