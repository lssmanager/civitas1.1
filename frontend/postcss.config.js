import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const plugins = { autoprefixer: {} };

try {
  require.resolve("@tailwindcss/postcss");
  plugins["@tailwindcss/postcss"] = {};
} catch {
  plugins.tailwindcss = {};
}

export default { plugins };
