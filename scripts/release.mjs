// Release helper: bumps the semver version, builds the app, and (best-effort)
// creates a matching release in Rustrak so error events are tagged with the
// version. Resolving old issues against a release keeps them from reopening.
//
//   bun run release          # bump patch (0.1.0 -> 0.1.1) and build
//   bun run release minor    # bump minor (0.1.0 -> 0.2.0) and build
//   bun run release major    # bump major (0.1.0 -> 1.0.0) and build
//
// Set RUSTRAK_API_URL and RUSTRAK_API_TOKEN (a Rustrak API token) to also
// create the release remotely. Without them the version is bumped and built
// locally only.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PKG_PATH = new URL("../package.json", import.meta.url);
const VERSION_TS_PATH = new URL("../src/version.ts", import.meta.url);
const RUSTRAK_API = process.env.RUSTRAK_API_URL || "http://rustrak-api.edideaur.works";
// Rustrak ignores the org segment of the Sentry-compatible release API; any
// non-empty value works, and the project slug determines where the release lands.
const ORG = process.env.RUSTRAK_ORG || "edi";
// Must match the Rustrak project slug (see package.json name / project config).
const PROJECT = "artistgrid";

function bump(version, kind) {
  const [major, minor, patch] = version.split(".").map((n) => parseInt(n, 10));
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const kind = process.argv[2] || "patch";
if (!["major", "minor", "patch"].includes(kind)) {
  console.error(`Unknown bump type "${kind}". Use major|minor|patch.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
const next = bump(pkg.version, kind);
pkg.version = next;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
writeFileSync(VERSION_TS_PATH, `export const APP_VERSION = "${next}";\n`);
console.log(`Bumped version -> ${next}`);

console.log("Building...");
execSync("bun run build", { stdio: "inherit" });

const token = process.env.RUSTRAK_API_TOKEN;
if (!token) {
  console.log(`\nSkipping remote Rustrak release (RUSTRAK_API_TOKEN not set).`);
  console.log(`Version ${next} is ready. Deploy the dist/ folder to ship it.`);
  process.exit(0);
}

try {
  const res = await fetch(`${RUSTRAK_API}/api/0/projects/${ORG}/${PROJECT}/releases/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      version: next,
      projects: [PROJECT],
    }),
  });
  if (res.ok) {
    console.log(`Created Rustrak release ${next}`);
  } else {
    console.warn(`Rustrak release create returned ${res.status} ${await res.text()}`);
  }
} catch (err) {
  console.warn("Could not create Rustrak release:", err.message);
}
