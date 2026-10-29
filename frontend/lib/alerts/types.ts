export type Grade = "A" | "B" | "C" | "D";
export type Locale = "he" | "en";
export type RequestOutcome =
  | "created"
  | "pending_refreshed"
  | "cooldown"
  | "already_active"
  | "suppressed"
  | "cap_reached";

export type SubscriptionView = {
  id: string;
  modelSlug: string;
  storageGb: number;
  condition: Grade;
  locale: Locale;
  status: "pending" | "active" | "paused";
  pendingExpiresAt: string | null;
};

export type DueSubscription = {
  id: string;
  email: string;
  emailHash: string;
  modelSlug: string;
  storageGb: number;
  condition: Grade;
  locale: Locale;
  baselinePrice: number | null;
  lastAlertAt: string | null;
  failureCount: number;
};

export type PriceQuote = {
  current: number | null;
  top: { company: string; price: number }[];
  modelName: string;
  brand: "apple" | "samsung";
};

export interface AlertRepository {
  request(input: {
    email: string;
    emailHash: string;
    modelSlug: string;
    storageGb: number;
    condition: Grade;
    locale: Locale;
    consentVersion: string;
    signupIpHash: string | null;
    maxPerEmail: number;
    confirmTtlHours: number;
  }): Promise<{ id: string | null; outcome: RequestOutcome }>;
  get(id: string): Promise<SubscriptionView | null>;
  confirm(id: string, baseline: number | null, retentionDays: number): Promise<"missing" | "already_active" | "expired" | "confirmed">;
  deleteOne(id: string): Promise<number>;
  deleteAll(id: string): Promise<number>;
  listDue(limit: number): Promise<DueSubscription[]>;
  markEvaluated(ids: string[]): Promise<void>;
  claim(id: string, claimId: string, cooldownHours: number): Promise<boolean>;
  finish(input: {
    id: string;
    claimId: string;
    kind: "up" | "down" | "available";
    oldPrice: number | null;
    newPrice: number;
    providerMessageId: string | null;
    retentionDays: number;
  }): Promise<void>;
  fail(input: {
    id: string;
    claimId: string;
    maxFailures: number;
    kind: "up" | "down" | "available";
    oldPrice: number | null;
    newPrice: number;
  }): Promise<void>;
  cleanup(): Promise<{ pendingDeleted: number; expiredDeleted: number; sendsDeleted: number }>;
  suppress(emailHash: string, reason: "bounce" | "complaint" | "manual"): Promise<number>;
}

export type OutboundEmail = {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

export interface EmailProvider {
  send(message: OutboundEmail): Promise<{ id: string }>;
}
