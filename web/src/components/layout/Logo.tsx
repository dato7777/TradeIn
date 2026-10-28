import { Link } from "@/i18n/navigation";

type LogoProps = {
  name: string;
  homeLabel: string;
};

export function Logo({ name, homeLabel }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${name} – ${homeLabel}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-control font-bold text-foreground"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        fill="none"
      >
        <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
        <rect x="10" y="6" width="12" height="20" rx="3" stroke="#fff" strokeWidth="2" />
        <path d="M13.5 17.5l2 2 3.5-4" stroke="var(--color-best-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="whitespace-nowrap text-lg leading-none">{name}</span>
    </Link>
  );
}
