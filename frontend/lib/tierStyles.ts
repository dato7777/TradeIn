/** Visual separators between condition tiers in unified row view. */
export const TIER_DIVIDER: Record<number, { color: string; tint: string }> = {
  1: { color: "#22c55e", tint: "rgba(34, 197, 94, 0.08)" },
  2: { color: "#3b82f6", tint: "rgba(59, 130, 246, 0.08)" },
  3: { color: "#f59e0b", tint: "rgba(245, 158, 11, 0.08)" },
  4: { color: "#ef4444", tint: "rgba(239, 68, 68, 0.08)" },
};

function tierColors(tier: number) {
  return TIER_DIVIDER[tier] || { color: "#64748b", tint: "rgba(100, 116, 139, 0.08)" };
}

export function tierColumnStyle(tier: number, isStart: boolean, index: number) {
  const d = tierColors(tier);
  const style: Record<string, string> = { backgroundColor: d.tint };
  if (isStart && index > 0) {
    style.borderLeft = `4px solid ${d.color}`;
    style.boxShadow = `-3px 0 12px ${d.color}40`;
  }
  return style;
}

export function tierGroupHeaderStyle(tier: number, groupIndex: number) {
  const d = tierColors(tier);
  const style: Record<string, string> = {
    backgroundColor: d.tint.replace("0.08", "0.14"),
    borderBottom: `3px solid ${d.color}`,
  };
  if (groupIndex > 0) {
    style.borderLeft = `4px solid ${d.color}`;
    style.boxShadow = `-3px 0 12px ${d.color}40`;
  }
  return style;
}
