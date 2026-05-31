"use client";

interface Props {
  children: React.ReactNode;
  className?: string;
}

/** Scrollable table viewport — sticky thead sticks to the top of this container. */
export function TableScroll({ children, className = "" }: Props) {
  return (
    <div
      className={`overflow-x-auto overflow-y-auto max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-11rem)] overscroll-x-contain touch-pan-x ${className}`}
    >
      {children}
    </div>
  );
}

/** Entire header block sticks together on vertical scroll. */
export const stickyThead = "sticky top-0 z-20";

/** Header cell background (use on every th in sticky thead). */
export const headerTh =
  "bg-surface-card shadow-[inset_0_-1px_0_0_rgb(45,58,79)]";

/** Sticky device column header — horizontal + corner above body rows. */
export const stickyThDeviceLtr =
  "sticky left-0 z-30 bg-surface-card shadow-[inset_-1px_0_0_0_rgb(45,58,79),inset_0_-1px_0_0_rgb(45,58,79)]";

/** Sticky device column body cell. */
export const stickyTdDeviceLtr =
  "sticky left-0 z-10 bg-surface-card shadow-[inset_-1px_0_0_0_rgb(45,58,79)]";

/** @deprecated use stickyThead + headerTh */
export const stickyTh =
  "sticky top-0 z-20 bg-surface-card shadow-[inset_0_-1px_0_0_rgb(45,58,79)]";

/** @deprecated */
export const stickyThDeviceRtl =
  "sticky right-0 top-0 z-30 bg-surface-card border-l border-surface-border shadow-[inset_0_-1px_0_0_rgb(45,58,79)]";

/** @deprecated */
export const stickyTdDeviceRtl =
  "sticky right-0 z-10 bg-surface-card border-l border-surface-border";
