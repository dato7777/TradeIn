export type AlertDecision =
  | { send: false; reason: "no_current" | "cooldown" | "below_threshold" }
  | {
      send: true;
      kind: "up" | "down" | "available";
      baseline: number | null;
      current: number;
      deltaIls: number;
      deltaPercent: number;
    };

export function evaluateAlert(input: {
  baseline: number | null;
  current: number | null;
  lastAlertAt: Date | null;
  now: Date;
  cfg: { minChangeIls: number; minChangePercent: number; cooldownHours: number };
}): AlertDecision {
  const { baseline, current, lastAlertAt, now, cfg } = input;
  if (current == null) return { send: false, reason: "no_current" };
  if (lastAlertAt) {
    const elapsedMs = now.getTime() - lastAlertAt.getTime();
    if (elapsedMs < cfg.cooldownHours * 60 * 60 * 1000) return { send: false, reason: "cooldown" };
  }
  if (baseline == null) {
    return { send: true, kind: "available", baseline: null, current, deltaIls: current, deltaPercent: 0 };
  }
  if (baseline <= 0) return { send: false, reason: "below_threshold" };
  const deltaIls = current - baseline;
  const abs = Math.abs(deltaIls);
  const percentMet = abs * 100 >= cfg.minChangePercent * baseline;
  const ilsMet = abs >= cfg.minChangeIls;
  if (!percentMet || !ilsMet) return { send: false, reason: "below_threshold" };
  return {
    send: true,
    kind: deltaIls > 0 ? "up" : "down",
    baseline,
    current,
    deltaIls,
    deltaPercent: (abs * 100) / baseline,
  };
}
