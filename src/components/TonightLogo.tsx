import Link from "next/link";

/** Logo TONIGHT. Volontairement sobre : le produit, c'est le moteur. */
export function TonightLogo({
  size = "md",
  withDot = true,
  asLink = true,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  withDot?: boolean;
  asLink?: boolean;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl sm:text-5xl",
    xl: "text-5xl sm:text-7xl",
  } as const;

  const content = (
    <span className={`t-logo ${sizes[size]} leading-none`}>
      TONIGHT
      {withDot ? <span className="text-violet">.</span> : null}
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href="/" aria-label="TONIGHT, retour à l'accueil" className="inline-flex items-center">
      {content}
    </Link>
  );
}
