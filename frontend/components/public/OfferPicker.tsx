import { catalogCopy } from "@/lib/catalogCopy";
import { formatStorage } from "@/lib/public/format";
import type { GradeRow } from "@/lib/public/schemas";
import type { PublicLocale } from "@/lib/publicCopy";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pub-primary";

export function OfferPicker({
  locale,
  action,
  storages,
  grades,
  storage,
  grade,
  showPendingNote,
}: {
  locale: PublicLocale;
  action: string;
  storages: number[];
  grades: GradeRow[];
  storage: number | null;
  grade: string | null;
  showPendingNote: boolean;
}) {
  const t = catalogCopy[locale];

  return (
    <form action={action} method="get" className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-lg font-semibold">{t.storageLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {storages.map((gb) => (
            <label
              key={gb}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-pub-border bg-white px-4 has-[:checked]:border-pub-primary has-[:checked]:bg-pub-surface"
            >
              <input
                type="radio"
                name="storage"
                value={gb}
                defaultChecked={storage === gb}
                required
                className={focus}
              />
              <span>{formatStorage(gb)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-lg font-semibold">{t.conditionLegend}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {grades.map((row) => (
            <label
              key={row.grade}
              className="flex min-h-11 cursor-pointer gap-3 rounded-xl border border-pub-border bg-white p-4 has-[:checked]:border-pub-primary has-[:checked]:bg-pub-surface"
            >
              <input
                type="radio"
                name="condition"
                value={row.grade}
                defaultChecked={grade === row.grade}
                required
                className={`mt-1 ${focus}`}
              />
              <span>
                <span className="block font-semibold">
                  {row.grade} · {locale === "he" ? row.name_he : row.name_en}
                </span>
                <span className="mt-1 block text-sm text-pub-muted">
                  {locale === "he" ? row.description_he : row.description_en}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-pub-muted">{t.confirmHint}</p>
      {showPendingNote ? <p className="text-sm text-pub-muted">{t.pendingNote}</p> : null}
      <button
        type="submit"
        className={`inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-pub-primary px-5 text-base font-semibold text-white hover:bg-pub-primary-hover sm:w-fit ${focus}`}
      >
        {t.confirm}
      </button>
    </form>
  );
}
