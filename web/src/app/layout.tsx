import "./globals.css";

// The real document (<html lang dir>) is rendered per locale in [locale]/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
