// Applies supabase/migrations to an in-memory Postgres (PGlite), recreates the
// production privilege state found in Phase 0, runs the pgTAP tests in
// supabase/tests, then checks that every rollback restores the previous state.
// Never touches a real database.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PGTAP_VERSION = "v1.3.3";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase");
const cacheFile = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", ".cache", `pgtap-${PGTAP_VERSION}.sql`);
const read = (path) => readFileSync(path, "utf8");

async function loadPgtap() {
  if (!existsSync(cacheFile)) {
    const url = `https://raw.githubusercontent.com/theory/pgtap/${PGTAP_VERSION}/sql/pgtap.sql.in`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download pgTAP: ${response.status}`);
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, await response.text());
  }
  return read(cacheFile).replace("'__OS__'", "'linux'").replace("__VERSION__", "1.33");
}

const db = new PGlite({ extensions: { pgcrypto } });
let failed = false;

async function step(label, sql) {
  try {
    await db.exec(sql);
    console.log(`ok   ${label}`);
  } catch (error) {
    console.log(`FAIL ${label}: ${error.message}`);
    process.exit(1);
  }
}

const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
const [initMigration, ...newMigrations] = migrations;

await step("supabase roles", `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;`);
await step("pgtap", `set search_path = extensions; ${await loadPgtap()}; reset search_path;`);
await step(initMigration, read(join(root, "migrations", initMigration)));
await step("production state from Phase 0 (RLS on, default grants)", `
  do $$ declare t text; begin
    foreach t in array array['companies','company_prices','profiles','scrape_jobs','upload_history'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('grant all on table public.%I to anon, authenticated, service_role', t);
    end loop;
  end $$;
  grant usage on schema public to anon, authenticated;`);
for (const migration of newMigrations) {
  await step(migration, read(join(root, "migrations", migration)));
}

for (const file of readdirSync(join(root, "tests")).filter((f) => f.endsWith(".test.sql")).sort()) {
  const sql = read(join(root, "tests", file)).replace(/create extension if not exists pgtap[^;]*;/, "");
  console.log(`\n== ${file}`);
  try {
    const results = await db.exec(sql);
    const lines = results
      .flatMap((result) => result.rows.map((row) => Object.values(row)[0]))
      .filter((value) => typeof value === "string" && /^(ok|not ok|#|1\.\.)/.test(value));
    for (const line of lines) console.log(line);
    if (lines.some((line) => line.startsWith("not ok") || line.includes("Looks like"))) failed = true;
  } catch (error) {
    console.log(`ERROR ${error.message}`);
    failed = true;
    await db.exec("rollback").catch(() => {});
  }
}

console.log("");
for (const migration of [...newMigrations].reverse()) {
  const rollback = join(root, "rollbacks", migration.replace(/\.sql$/, ".down.sql"));
  if (!existsSync(rollback)) {
    console.log(`FAIL missing rollback for ${migration}`);
    failed = true;
    continue;
  }
  await step(`rollback ${migration}`, read(rollback));
}
const { rows } = await db.query(`
  select count(*)::int as n from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')`);
if (rows[0].n !== 70) {
  console.log(`FAIL rollback restored ${rows[0].n} grants, expected 70`);
  failed = true;
} else {
  console.log("ok   rollbacks restore the original 70 grants");
}
for (const migration of newMigrations) {
  await step(`re-apply ${migration}`, read(join(root, "migrations", migration)));
}

process.exit(failed ? 1 : 0);
