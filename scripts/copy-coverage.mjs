import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const src = path.join(projectRoot, "coverage");
const dest = path.join(projectRoot, "dist", "coverage");

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(src)) {
  console.warn("[copy-coverage] no coverage/ directory found; skipping.");
  process.exit(0);
}

copyRecursive(src, dest);
console.log(`[copy-coverage] copied coverage report to dist/coverage`);
