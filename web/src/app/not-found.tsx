import Link from "next/link";

// Fallback for requests that never reach a locale segment.
export default function RootNotFound() {
  return (
    <html lang="he" dir="rtl">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground">
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-2xl font-bold">הדף לא נמצא · Page not found</h1>
          <Link href="/" className="text-primary underline">
            חזרה לדף הבית · Back to home
          </Link>
        </div>
      </body>
    </html>
  );
}
