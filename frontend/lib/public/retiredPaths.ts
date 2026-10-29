const RETIRED = new Set(["login", "signup", "reset-password", "account", "auth"]);

export function isRetiredAccountPath(parts: string[]): boolean {
  return RETIRED.has(parts[0] ?? "");
}
