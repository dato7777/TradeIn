"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, type UserMe } from "@/lib/api";

const NAV = [
  { href: "/summary", label: "Summary" },
  { href: "/companies/dynamica", label: "Dynamica" },
  { href: "/companies/partner", label: "Partner" },
  { href: "/companies/ksp", label: "KSP" },
  { href: "/companies/pelephone", label: "Pelephone" },
];

const EXTRACT_DATA_HREF = "/admin/scrape";

function navLinkClass(active: boolean, mobile = false) {
  return `${
    mobile ? "block w-full" : "inline-block"
  } px-3 py-2 md:py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
    active
      ? "bg-accent-muted text-blue-300"
      : "text-slate-400 hover:text-white hover:bg-surface-border/50"
  }`;
}

const extractDataClass = (active: boolean, mobile = false) =>
  `${
    mobile ? "block w-full text-center" : "inline-block"
  } px-3 py-2 md:py-1.5 rounded-md text-sm font-semibold whitespace-nowrap transition-all ` +
  `bg-gradient-to-b from-red-500 to-red-700 text-white ` +
  `shadow-[0_3px_14px_rgba(220,38,38,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] ` +
  `hover:from-red-400 hover:to-red-600 hover:shadow-[0_5px_18px_rgba(220,38,38,0.55)] ` +
  `${active ? "ring-2 ring-red-300/60" : ""}`;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadUser = useCallback(async () => {
    if (pathname === "/login") return;
    try {
      const me = await apiFetch<UserMe>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      router.replace("/login");
    }
  }, [pathname, router]);

  useEffect(() => {
    loadUser();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });
    return () => subscription.unsubscribe();
  }, [loadUser]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.replace("/login");
  }

  if (pathname === "/login") return <>{children}</>;

  const widePage =
    pathname === "/summary" || pathname.startsWith("/companies/");

  const adminLinks =
    user?.role === "admin" ? [{ href: EXTRACT_DATA_HREF, label: "Extract Data" }] : [];

  const allLinks = [...NAV, ...adminLinks];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function renderNavLink(item: { href: string; label: string }, mobile = false) {
    const active = isActive(item.href);
    if (item.href === EXTRACT_DATA_HREF) {
      return (
        <Link
          key={item.href}
          href={item.href}
          className={extractDataClass(active, mobile)}
        >
          {item.label}
        </Link>
      );
    }
    return (
      <Link key={item.href} href={item.href} className={navLinkClass(active, mobile)}>
        {item.label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface text-slate-100 overflow-x-hidden">
      <header className="border-b border-surface-border bg-surface-card/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 md:flex-initial">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden shrink-0 rounded-md border border-surface-border p-2 text-slate-300 hover:bg-surface-border/50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <BrandLogo />
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto min-w-0">
              {allLinks.map((item) => renderNavLink(item))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
            {user?.email && (
              <span className="text-slate-400 max-w-[8rem] sm:max-w-[12rem] truncate hidden sm:inline">
                {user.email}
                {user.role === "admin" && (
                  <span className="ml-2 text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">
                    admin
                  </span>
                )}
              </span>
            )}
            <button
              onClick={logout}
              className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-surface-border text-xs sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-surface-border/60 px-3 py-2 flex flex-col gap-1">
            {allLinks.map((item) => renderNavLink(item, true))}
            {user?.email && (
              <span className="text-xs text-slate-500 px-3 pt-2 border-t border-surface-border/60 mt-1">
                {user.email}
                {user.role === "admin" && (
                  <span className="ml-2 text-amber-300">admin</span>
                )}
              </span>
            )}
          </nav>
        )}
      </header>
      <main
        className={`mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 w-full min-w-0 ${
          widePage ? "max-w-none" : "max-w-7xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
