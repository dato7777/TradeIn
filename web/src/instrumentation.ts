export async function register() {
  // Fail fast at boot if the environment is invalid.
  await import("./env/server");
}
