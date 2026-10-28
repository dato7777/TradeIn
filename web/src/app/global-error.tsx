"use client";

// Replaces the root layout when it fails, so it cannot rely on i18n or global CSS.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0F172A",
          background: "#FFFFFF",
        }}
      >
        <title>שגיאה · Error</title>
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>משהו השתבש · Something went wrong</h1>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 10,
              background: "#1D4ED8",
              color: "#FFFFFF",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ניסיון חוזר · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
