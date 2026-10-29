"use client";

import { useState } from "react";
import Link from "next/link";
import { confirmPriceAlert, unsubscribePriceAlert } from "@/app/actions/priceAlerts";
import { alertsCopy, fill } from "@/lib/alertsCopy";
import { formatStorage } from "@/lib/public/format";
import { localeHome, type PublicLocale } from "@/lib/publicCopy";

type Preview =
  | { ok: false; code: "rate_limited" | "error" }
  | { ok: true; state: "invalid" }
  | { ok: true; state: "done" }
  | { ok: true; state: "already" | "ready"; modelName: string; storageGb: number; condition: string; locale: PublicLocale };

type Screen =
  | "rate"
  | "error"
  | "invalid"
  | "confirm-ready"
  | "confirm-done"
  | "confirm-already"
  | "unsub-ready"
  | "unsub-one"
  | "unsub-all";

function screenFor(purpose: "confirm" | "manage", preview: Preview): { screen: Screen; chip: string } {
  if (!preview.ok) return { screen: preview.code === "rate_limited" ? "rate" : "error", chip: "" };
  if (preview.state === "invalid") return { screen: "invalid", chip: "" };
  if (preview.state === "done") return { screen: purpose === "manage" ? "unsub-one" : "invalid", chip: "" };
  const chip = fill(alertsCopy[preview.locale].selection, {
    model: preview.modelName,
    storage: formatStorage(preview.storageGb),
    grade: preview.condition,
  });
  if (purpose === "confirm") return { screen: preview.state === "already" ? "confirm-already" : "confirm-ready", chip };
  return { screen: "unsub-ready", chip };
}

export function AlertFlow({
  locale,
  purpose,
  token,
  preview,
}: {
  locale: PublicLocale;
  purpose: "confirm" | "manage";
  token: string;
  preview: Preview;
}) {
  const t = alertsCopy[locale];
  const initial = screenFor(purpose, preview);
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [pending, setPending] = useState(false);
  const chip = initial.chip;
  const copy: Record<Screen, string> = {
    rate: t.errorRate,
    error: t.errorGeneric,
    invalid: t.linkInvalid,
    "confirm-ready": t.confirmBody,
    "confirm-done": t.confirmDone,
    "confirm-already": t.confirmAlready,
    "unsub-ready": "",
    "unsub-one": t.unsubDoneOne,
    "unsub-all": t.unsubDoneAll,
  };

  async function confirm() {
    setPending(true);
    const result = await confirmPriceAlert(token);
    setPending(false);
    if (!result.ok) setScreen(result.code === "rate_limited" ? "rate" : "error");
    else if (result.status === "confirmed") setScreen("confirm-done");
    else if (result.status === "already") setScreen("confirm-already");
    else setScreen("invalid");
  }

  async function stop(scope: "one" | "all") {
    setPending(true);
    const result = await unsubscribePriceAlert(token, scope);
    setPending(false);
    if (!result.ok) setScreen(result.code === "rate_limited" ? "rate" : "error");
    else if (result.status === "invalid") setScreen("invalid");
    else setScreen(scope === "all" ? "unsub-all" : "unsub-one");
  }

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <section className="rounded-xl border border-pub-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{purpose === "confirm" ? t.confirmTitle : t.unsubTitle}</h1>
        {copy[screen] ? <p className="mt-3 text-pub-muted">{copy[screen]}</p> : null}
        {chip && screen !== "invalid" && screen !== "rate" && screen !== "error" ? (
          <p className="mt-4 inline-block max-w-full truncate rounded-full bg-pub-surface px-3 py-1 text-sm tabular-nums" title={chip}>
            {chip}
          </p>
        ) : null}
        {screen === "confirm-ready" ? (
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-pub-primary px-4 font-semibold text-white"
          >
            {t.confirmButton}
          </button>
        ) : null}
        {screen === "unsub-ready" ? (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => stop("one")}
              className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-pub-primary px-4 font-semibold text-white"
            >
              {t.unsubOne}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => stop("all")}
              className="inline-flex h-12 w-full items-center justify-center rounded-[10px] border border-pub-primary bg-white px-4 font-semibold text-pub-primary"
            >
              {t.unsubAll}
            </button>
          </div>
        ) : null}
        <Link href={localeHome(locale)} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-pub-primary">
          {t.backToSite}
        </Link>
      </section>
    </div>
  );
}
