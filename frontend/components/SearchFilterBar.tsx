"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  brand: string;
  onBrandChange: (v: string) => void;
}

export function SearchFilterBar({ value, onChange, brand, onBrandChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
      <input
        type="search"
        placeholder="Search device..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:flex-1 min-w-0 rounded-lg border border-surface-border bg-surface-card px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <select
        value={brand}
        onChange={(e) => onBrandChange(e.target.value)}
        className="w-full sm:w-auto rounded-lg border border-surface-border bg-surface-card px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">All brands</option>
        <option value="apple">Apple</option>
        <option value="samsung">Samsung</option>
      </select>
    </div>
  );
}
