import ts from "typescript";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { $ } from "bun";

function stripComments(source: string, filePath: string): string {
  const isJsx = filePath.endsWith(".tsx");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const printer = ts.createPrinter({ removeComments: true });
  return printer.printFile(sourceFile);
}

function processDir(dir: string) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      const source = readFileSync(fullPath, "utf-8");
      const stripped = stripComments(source, fullPath);
      if (stripped !== source) writeFileSync(fullPath, stripped, "utf-8");
    }
  }
}

for (const dir of ["src", "components", "lib"]) {
  processDir(dir);
}

await $`bun node_modules/.bin/prettier --write "src/**/*.{ts,tsx}" "components/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}"`;
