import { Webhook } from "svix";
import { beforeEach, describe, expect, it } from "vitest";
import type { AlertConfig } from "@/lib/alerts/config";
import { handleCron, handleEmailWebhook, handleOneClick } from "@/lib/alerts/http";
import { clearMemoryOutbox, memoryOutbox, memoryProvider } from "@/lib/alerts/provider";
import { memoryLimiter } from "@/lib/alerts/rateLimit";
import { runEvaluation, runSubscribe, type AlertDeps } from "@/lib/alerts/service";
import type { AlertRepository, DueSubscription, RequestOutcome } from "@/lib/alerts/types";

const id = "11111111-1111-4111-8111-111111111111";

function config(): AlertConfig {
  return {
    hashSecret: "h".repeat(40),
    tokenSecret: "t".repeat(40),
    emailFrom: "alerts@mail.example.com",
    replyTo: "reply@example.com",
    cronSecret: "cron-secret-value",
    webhookSecret: `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`,
    minChangeIls: 30,
    minChangePercent: 3,
    cooldownHours: 24,
    batchSize: 10,
    maxPerEmail: 5,
    maxFailures: 2,
    confirmTtlHours: 48,
    retentionDays: 365,
    maxConfirmationsPerDay: 2000,
    adLabel: false,
    allowRealSendNonProd: false,
    provider: "memory",
    turnstileHostnames: ["example.com"],
  };
}

function deps(repo: AlertRepository, extra: Partial<AlertDeps> = {}): AlertDeps {
  return {
    config: config(),
    repo,
    limiter: memoryLimiter(),
    mailer: memoryProvider(),
    phoneExists: async () => true,
    quote: async () => ({
      current: 1900,
      top: [{ company: "Alpha", price: 1900 }],
      modelName: "iPhone 13",
      brand: "apple",
    }),
    verifyTurnstile: async () => true,
    schedule: (task) => {
      void task();
    },
    ...extra,
  };
}

async function subscribe(outcome: RequestOutcome, value = input, extra: Partial<AlertDeps> = {}) {
  const pending: Promise<void>[] = [];
  const result = await runSubscribe(
    value,
    deps(repo(outcome), {
      ...extra,
      schedule: (task) => {
        pending.push(task());
      },
    }),
  );
  await Promise.all(pending);
  return result;
}

function repo(outcome: RequestOutcome = "created"): AlertRepository {
  return {
    request: async () => ({ id, outcome }),
    get: async () => null,
    confirm: async () => "confirmed",
    deleteOne: async () => 1,
    deleteAll: async () => 2,
    listDue: async () => [],
    markEvaluated: async () => undefined,
    claim: async () => true,
    finish: async () => undefined,
    fail: async () => undefined,
    cleanup: async () => ({ pendingDeleted: 0, expiredDeleted: 0, sendsDeleted: 0 }),
    suppress: async () => 1,
  };
}

const input = {
  email: "Person@Example.com",
  modelSlug: "iphone-13",
  storage: 128,
  condition: "A" as const,
  locale: "en" as const,
  turnstileToken: "token",
  website: "",
  ip: "203.0.113.8",
};

describe("subscribe", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    clearMemoryOutbox();
  });

  it("returns the same success shape for every stored outcome", async () => {
    for (const outcome of ["created", "pending_refreshed", "cooldown", "already_active", "suppressed", "cap_reached"] as const) {
      expect(await subscribe(outcome)).toEqual({ ok: true });
    }
    expect(await subscribe("created", { ...input, website: "filled" })).toEqual({ ok: true });
  });

  it("rate limits the sixth attempt from one address", async () => {
    const limited = deps(repo());
    for (let i = 0; i < 5; i += 1) {
      await subscribe("created", { ...input, email: `p${i}@example.com` }, { limiter: limited.limiter });
    }
    expect(await subscribe("created", { ...input, email: "p6@example.com" }, { limiter: limited.limiter })).toEqual({
      ok: false,
      code: "rate_limited",
    });
  });
});

describe("evaluation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    clearMemoryOutbox();
  });

  function due(overrides: Partial<DueSubscription> = {}): DueSubscription {
    return {
      id,
      email: "person@example.com",
      emailHash: "ab".repeat(32),
      modelSlug: "iphone-13",
      storageGb: 128,
      condition: "A",
      locale: "en",
      baselinePrice: 1000,
      lastAlertAt: null,
      failureCount: 0,
      ...overrides,
    };
  }

  it("sends once, then nothing on the next run", async () => {
    let row = due();
    let sends = 0;
    const store = repo();
    store.listDue = async () => [row];
    store.finish = async (finished) => {
      sends += 1;
      row = { ...row, baselinePrice: finished.newPrice, lastAlertAt: new Date().toISOString() };
    };
    const first = await runEvaluation(deps(store, { now: () => new Date("2026-10-30T00:00:00Z") }));
    const second = await runEvaluation(deps(store, { now: () => new Date("2026-10-30T01:00:00Z") }));
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(sends).toBe(1);
    const alerts = memoryOutbox().filter((message) => message.headers?.["List-Unsubscribe"]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.headers?.["List-Unsubscribe"]).toContain("https://example.com/api/alerts/unsubscribe");
  });

  it("does not double-send when a second claim loses", async () => {
    let claimed = false;
    const store = repo();
    store.listDue = async () => [due()];
    store.claim = async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    };
    const [left, right] = await Promise.all([
      runEvaluation(deps(store)),
      runEvaluation(deps(store)),
    ]);
    expect(left.sent + right.sent).toBe(1);
    expect(memoryOutbox()).toHaveLength(1);
  });

  it("asks the repository to record a failure", async () => {
    const failures: number[] = [];
    const store = repo();
    store.listDue = async () => [due()];
    store.fail = async (failed) => {
      failures.push(failed.maxFailures);
    };
    const result = await runEvaluation(
      deps(store, {
        mailer: {
          async send() {
            throw new Error("down");
          },
        },
      }),
    );
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(failures).toEqual([2]);
  });
});

describe("http", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it("rejects a cron call without the secret", async () => {
    const response = await handleCron(new Request("https://example.com/api/cron/price-alerts?task=evaluate"), deps(repo()));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
  });

  it("rejects a bad webhook signature and suppresses a complaint twice", async () => {
    const bad = await handleEmailWebhook(
      new Request("https://example.com/api/webhooks/email", {
        method: "POST",
        body: "{}",
        headers: { "svix-id": "msg_1", "svix-timestamp": "1", "svix-signature": "v1,bad" },
      }),
      deps(repo()),
    );
    expect(bad.status).toBe(401);

    const suppressed: string[] = [];
    const store = repo();
    store.suppress = async (hash) => {
      suppressed.push(hash);
      return suppressed.length === 1 ? 1 : 0;
    };
    const payload = JSON.stringify({ type: "email.complained", data: { to: ["Person@Example.com"] } });
    const secret = config().webhookSecret!;
    const msgId = "msg_2";
    const signedAt = new Date();
    const signature = new Webhook(secret).sign(msgId, signedAt, payload);
    const timestamp = String(Math.floor(signedAt.getTime() / 1000));
    const call = () =>
      handleEmailWebhook(
        new Request("https://example.com/api/webhooks/email", {
          method: "POST",
          body: payload,
          headers: { "svix-id": msgId, "svix-timestamp": timestamp, "svix-signature": signature },
        }),
        deps(store),
      );
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect(suppressed).toHaveLength(2);
    expect(new Set(suppressed).size).toBe(1);
  });

  it("one-click unsubscribe is POST-only and idempotent", async () => {
    const get = await handleOneClick(new Request("https://example.com/api/alerts/unsubscribe?token=x"), deps(repo()));
    expect(get.status).toBe(405);
    const post = await handleOneClick(
      new Request("https://example.com/api/alerts/unsubscribe?token=x", {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
      }),
      deps(repo()),
    );
    expect(post.status).toBe(200);
  });
});
