"use client";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function DynamicaVatCheckbox({ checked, onChange }: Props) {
  return (
    <label
      className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-slate-200 cursor-pointer select-none hover:border-slate-500"
      dir="rtl"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-sky-500"
      />
      <span>מע״מ 18%</span>
    </label>
  );
}
