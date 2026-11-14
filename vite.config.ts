import { defineConfig } from "vite";

// Relative base so the built files work from itch.io's iframe path.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", assetsInlineLimit: 0 },
});
