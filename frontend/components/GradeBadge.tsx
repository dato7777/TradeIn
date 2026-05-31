"use client";

interface Props {
  label: string;
  accentColor?: string;
  className?: string;
}

/** Outlined pill for Hebrew/English grade labels in table headers. */
export function GradeBadge({ label, accentColor = "#94a3b8", className = "" }: Props) {
  return (
    <span
      dir="rtl"
      className={`inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-[11px] sm:text-xs font-semibold leading-snug text-slate-100 ${className}`}
      style={{
        borderColor: `${accentColor}aa`,
        backgroundColor: `${accentColor}28`,
        boxShadow: `0 0 0 1px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
      title={label}
    >
      <span className="line-clamp-2 text-center">{label}</span>
    </span>
  );
}
