"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { catalogCopy } from "@/lib/catalogCopy";
import { publicModelName } from "@/lib/public/modelName";
import { modelPath } from "@/lib/public/paths";
import { brandSchema, modelSlugSchema, type SearchHit } from "@/lib/public/schemas";
import type { PublicLocale } from "@/lib/publicCopy";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary";

function isHit(value: unknown): value is SearchHit {
  if (!value || typeof value !== "object") return false;
  const row = value as SearchHit;
  return (
    brandSchema.safeParse(row.brand).success &&
    modelSlugSchema.safeParse(row.model_slug).success &&
    typeof row.display_name_he === "string" &&
    typeof row.display_name_en === "string"
  );
}

export function ModelSearch({ locale }: { locale: PublicLocale }) {
  const t = catalogCopy[locale];
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setOpen(false);
      setMessage("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search");
        const body: unknown = await response.json();
        const next = Array.isArray(body) ? body.filter(isHit) : [];
        setItems(next);
        setActive(0);
        setOpen(true);
        setMessage(next.length === 0 ? t.searchEmpty : "");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setItems([]);
        setOpen(false);
        setMessage(t.searchError);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, t.searchEmpty, t.searchError]);

  function go(hit: SearchHit) {
    router.push(modelPath(locale, hit.brand, hit.model_slug));
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <label htmlFor="search" className="mb-2 block text-sm font-semibold text-pub-fg">
        {t.searchLabel}
      </label>
      <input
        id="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        value={query}
        placeholder={t.searchPlaceholder}
        autoComplete="off"
        dir="auto"
        className={`h-12 w-full rounded-[10px] border border-pub-border bg-white px-4 text-base text-pub-fg shadow-sm [unicode-bidi:plaintext] ${focus}`}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (!open || items.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % items.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + items.length) % items.length);
          } else if (event.key === "Enter" && items[active]) {
            event.preventDefault();
            go(items[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.searchResults}
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-pub-border bg-white shadow-sm"
        >
          {items.map((hit, index) => {
            const name = publicModelName(locale, hit.display_name_he, hit.display_name_en);
            return (
              <li key={`${hit.brand}-${hit.model_slug}`} role="presentation">
                <button
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  dir="auto"
                  className={`flex min-h-11 w-full items-center px-4 text-start text-base [unicode-bidi:plaintext] ${focus} ${
                    index === active ? "bg-pub-surface" : "bg-white"
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(hit)}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {message && !open ? <p className="mt-2 text-sm text-pub-muted">{message}</p> : null}
    </div>
  );
}
