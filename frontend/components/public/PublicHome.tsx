import { publicCopy, type PublicLocale } from "@/lib/publicCopy";

export function PublicHome({ locale }: { locale: PublicLocale }) {
  const t = publicCopy[locale];

  return (
    <>
      <section className="border-b border-pub-border bg-pub-surface">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-12 sm:px-6 md:py-20">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t.title}</h1>
          <p className="max-w-2xl text-lg text-pub-muted">{t.subtitle}</p>
          <p className="inline-flex w-fit rounded-[10px] bg-pub-best px-3 py-2 text-sm font-medium text-pub-best-fg">
            {t.badge}
          </p>
        </div>
      </section>
      <section aria-labelledby="steps-title" className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
        <h2 id="steps-title" className="mb-6 text-2xl font-bold">
          {t.stepsTitle}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {t.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-xl border border-pub-border bg-pub-bg p-5 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-primary text-lg font-bold text-white"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-pub-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
