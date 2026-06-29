import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const indexPath = new URL("../dist/index.html", import.meta.url);

const fail = (message) => {
  console.error(`[owner-visual] ${message}`);
  process.exit(1);
};

if (!existsSync(indexPath)) fail("dist/index.html is missing; run vite build first.");

const html = readFileSync(indexPath, "utf8");
if (!/<link[^>]+rel="stylesheet"[^>]+href="\/assets\//.test(html)) {
  fail("built HTML does not reference a CSS asset, which would render an unstyled app.");
}

const assetsDir = join(distDir.pathname, "assets");
const cssFiles = existsSync(assetsDir) ? readdirSync(assetsDir).filter((file) => file.endsWith(".css")) : [];
if (cssFiles.length === 0) fail("no CSS assets were emitted by the frontend build.");

const css = cssFiles.map((file) => readFileSync(join(assetsDir, file), "utf8")).join("\n");
for (const selector of [".owner-shell", ".owner-topbar", ".owner-primary-nav", ".owner-card", ".owner-field"]) {
  if (!css.includes(selector)) fail(`critical owner selector ${selector} is missing from built CSS.`);
}

if (!/\.owner-card[^}]*border-radius/.test(css) || !/\.owner-topbar[^}]*border-bottom/.test(css)) {
  fail("critical owner layout CSS lacks expected card radius or topbar border declarations.");
}

console.log("[owner-visual] Built owner shell, navigation, card, and form styles are present.");
