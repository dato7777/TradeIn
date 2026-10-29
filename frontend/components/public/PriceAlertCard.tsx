"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { subscribeToPriceAlert } from "@/app/actions/priceAlerts";
import { BellIcon } from "@/components/public/BellIcon";
import { alertsCopy, fill } from "@/lib/alertsCopy";
import { formatStorage } from "@/lib/public/format";
import { localePath } from "@/lib/public/paths";
import type { PublicLocale } from "@/lib/publicCopy";

type Phase = "idle" | "submitting" | "success" | "invalid" | "rate" | "error";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          appearance: "interaction-only";
          callback: (token: string) => void;
          "error-callback": () => void;
          "expired-callback": () => void;
        },
      ) => string;
    };
  }
}

function loadTurnstile(onLoad: () => void) {
  if (window.turnstile) {
    onLoad();
    return;
  }
  const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
  if (existing) {
    existing.addEventListener("load", onLoad, { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.dataset.turnstile = "true";
  script.addEventListener("load", onLoad, { once: true });
  document.head.appendChild(script);
}

export function PriceAlertCard({
  locale,
  modelName,
  modelSlug,
  storageGb,
  grade,
  variant,
  siteKey,
}: {
  locale: PublicLocale;
  modelName: string;
  modelSlug: string;
  storageGb: number;
  grade: string;
  variant: "full" | "compact";
  siteKey: string | null;
}) {
  const t = alertsCopy[locale];
  const emailId = useId();
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [touched, setTouched] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const chip = fill(t.selection, { model: modelName, storage: formatStorage(storageGb), grade });
  const privacyHref = localePath(locale, "/privacy");
  const [consentBefore, consentAfter] = t.consent.split("{privacyLink}");
  const invalid = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !siteKey) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      loadTurnstile(() => {
        const box = widgetRef.current;
        if (!box || !window.turnstile || box.childElementCount > 0) return;
        window.turnstile.render(box, {
          sitekey: siteKey,
          action: "price-alert",
          appearance: "interaction-only",
          callback: (value) => setToken(value),
          "error-callback": () => setToken(""),
          "expired-callback": () => setToken(""),
        });
      });
    };
    card.addEventListener("focusin", start);
    card.addEventListener("pointerdown", start);
    return () => {
      card.removeEventListener("focusin", start);
      card.removeEventListener("pointerdown", start);
    };
  }, [siteKey]);

  useEffect(() => {
    if (phase !== "success") return;
    headingRef.current?.focus();
    setSeconds(60);
    const timer = window.setInterval(() => setSeconds((current) => (current > 0 ? current - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setTouched(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setPhase("invalid");
      return;
    }
    setPhase("submitting");
    const result = await subscribeToPriceAlert({
      email,
      modelSlug,
      storage: storageGb,
      condition: grade,
      locale,
      turnstileToken: token,
      website,
    });
    if (result.ok) setPhase("success");
    else if (result.code === "invalid_email") setPhase("invalid");
    else if (result.code === "rate_limited") setPhase("rate");
    else setPhase("error");
  }

  const form = (
    <form className="flex w-full flex-col gap-3" onSubmit={submit} aria-busy={phase === "submitting"} noValidate>
      <label htmlFor={emailId} className="sr-only">
        {t.emailLabel}
      </label>
      <input
        id={emailId}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        dir="auto"
        value={email}
        placeholder={t.emailPlaceholder}
        aria-invalid={phase === "invalid" || invalid}
        aria-describedby={phase === "invalid" || invalid ? errorId : undefined}
        onBlur={() => setTouched(true)}
        onChange={(event) => {
          setEmail(event.target.value);
          if (phase === "invalid" || phase === "rate" || phase === "error") setPhase("idle");
        }}
        className="h-12 w-full rounded-[10px] border border-pub-border bg-white px-3 text-base text-pub-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary"
      />
      <label className="sr-only" aria-hidden="true">
        Website
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>
      <div ref={widgetRef} />
      {phase === "invalid" || invalid ? (
        <p id={errorId} className="text-sm text-pub-error" role="alert">
          {t.errorInvalid}
        </p>
      ) : null}
      {phase === "rate" ? (
        <p className="text-sm text-pub-error" role="alert">
          {t.errorRate}
        </p>
      ) : null}
      {phase === "error" ? (
        <p className="text-sm text-pub-error" role="alert">
          {t.errorGeneric}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={phase === "submitting"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-pub-primary px-4 text-base font-semibold text-white hover:bg-pub-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary disabled:opacity-70 sm:w-auto sm:min-w-[8.5rem]"
      >
        {phase === "submitting" ? (
          <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white border-e-transparent" />
        ) : null}
        {phase === "submitting" ? t.submitting : t.submit}
      </button>
      <p className="text-xs leading-5 text-pub-muted sm:text-[13px]">
        {consentBefore}
        <a href={privacyHref} className="underline">
          {t.privacyLink}
        </a>
        {consentAfter}
      </p>
    </form>
  );

  return (
    <section
      ref={cardRef}
      id="price-alert"
      aria-labelledby="price-alert-title"
      className="scroll-mt-24 rounded-xl border border-pub-primary-tint-border bg-pub-primary-tint p-4 shadow-sm sm:p-6"
    >
      <div aria-live="polite">
        {phase === "success" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-best text-pub-cta">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h2 id="price-alert-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none sm:text-xl">
                  {t.successTitle}
                </h2>
                <p className="mt-1 text-sm text-pub-muted">
                  {t.successBody.split("{email}")[0]}
                  <bdi dir="ltr">{email.trim()}</bdi>
                  {t.successBody.split("{email}")[1]}
                </p>
                <p className="mt-1 text-sm text-pub-muted">{t.successHint}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={seconds > 0 || phase !== "success"}
                onClick={() => submit()}
                className="inline-flex h-12 items-center justify-center rounded-[10px] bg-pub-primary px-4 text-base font-semibold text-white disabled:opacity-70"
              >
                {seconds > 0 ? fill(t.resendIn, { seconds: String(seconds) }) : t.resend}
              </button>
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-[10px] px-4 text-base font-semibold text-pub-primary"
                onClick={() => {
                  setEmail("");
                  setTouched(false);
                  setPhase("idle");
                }}
              >
                {t.changeEmail}
              </button>
            </div>
          </div>
        ) : variant === "compact" ? (
          <div className="flex flex-col gap-3">
            <h2 id="price-alert-title" className="text-lg font-semibold">
              {t.emptyTitle}
            </h2>
            {form}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 sm:max-w-md">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-pub-primary">
                <BellIcon className="h-5 w-5" />
              </div>
              <h2 id="price-alert-title" className="text-lg font-semibold sm:text-xl">
                {t.title}
              </h2>
              <p className="mt-1 text-sm text-pub-muted sm:text-[15px]">{t.subtitle}</p>
              <p title={chip} className="mt-3 inline-block max-w-full truncate rounded-full bg-white px-3 py-1 text-sm tabular-nums">
                {chip}
              </p>
            </div>
            <div className="w-full sm:max-w-sm">{form}</div>
          </div>
        )}
      </div>
    </section>
  );
}
