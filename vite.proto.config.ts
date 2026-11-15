import { defineConfig } from "vite";

// bundles the network layer into one classic script for the plain-JS prototype (src/proto/entry.ts)
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "prototype/js",
    emptyOutDir: false,
    lib: { entry: "src/proto/entry.ts", name: "HSNet", formats: ["iife"], fileName: () => "net.js" },
  },
});
