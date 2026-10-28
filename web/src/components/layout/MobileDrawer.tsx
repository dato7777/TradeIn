"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { NavLink } from "./NavLink";

type MobileDrawerProps = {
  items: ReadonlyArray<{ href: string; label: string }>;
  labels: { open: string; close: string; title: string; nav: string };
  footer?: React.ReactNode;
};

export function MobileDrawer({ items, labels, footer }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={labels.open}
        className="inline-flex size-11 items-center justify-center rounded-control text-foreground hover:bg-surface lg:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 end-0 z-50 flex h-dvh w-[min(20rem,85vw)] flex-col bg-background pb-[env(safe-area-inset-bottom)] shadow-card"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <Dialog.Title className="text-base font-semibold">
              {labels.title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={labels.close}
              className="inline-flex size-11 items-center justify-center rounded-control hover:bg-surface"
            >
              <X aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>
          <nav aria-label={labels.nav} className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    className="flex min-h-11 items-center rounded-control px-3 text-base text-foreground hover:bg-surface"
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {footer ? (
            <div className="border-t border-border p-2">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
