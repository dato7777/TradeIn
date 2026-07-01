import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  center?: ReactNode;
  rtl?: boolean;
  titleClassName?: string;
}

export function PageHeader({ title, subtitle, actions, center, rtl, titleClassName }: Props) {
  return (
    <div className="flex flex-col gap-4 mb-4 sm:mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className={`min-w-0 shrink-0 ${rtl ? "text-right" : ""}`} dir={rtl ? "rtl" : undefined}>
          <h1
            className={`text-xl sm:text-2xl font-bold truncate ${
              titleClassName || "text-white"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={`text-slate-400 text-sm mt-1 ${rtl ? "text-right" : ""}`}>{subtitle}</p>
          )}
        </div>
        {center && (
          <div className="flex flex-1 items-center justify-center min-w-0 order-last lg:order-none">
            {center}
          </div>
        )}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 lg:ml-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
