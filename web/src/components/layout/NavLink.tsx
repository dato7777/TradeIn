"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link> & { href: string };

export function NavLink({ href, className, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        className,
        isActive && "text-primary font-semibold",
      )}
      {...props}
    />
  );
}
