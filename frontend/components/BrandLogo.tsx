import { Rajdhani } from "next/font/google";
import Link from "next/link";

const brandFont = Rajdhani({ subsets: ["latin"], weight: ["600", "700"] });

interface Props {
  href?: string;
  className?: string;
}

export function BrandLogo({ href = "/summary", className = "" }: Props) {
  const logo = (
    <span
      className={`${brandFont.className} inline-flex items-baseline gap-1.5 select-none ${className}`}
    >
      <span className="text-xl sm:text-2xl font-bold tracking-[0.18em] uppercase bg-gradient-to-br from-cyan-300 via-sky-100 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(56,189,248,0.4)]">
        RES
      </span>
      <span className="text-xl sm:text-2xl font-semibold tracking-[0.32em] uppercase text-slate-200 drop-shadow-[0_1px_0_rgba(255,255,255,0.15)]">
        PARTS
      </span>
    </span>
  );

  if (!href) return logo;

  return (
    <Link href={href} className="shrink-0 hover:opacity-90 transition-opacity">
      {logo}
    </Link>
  );
}
