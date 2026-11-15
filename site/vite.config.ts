import { defineConfig } from 'vite';

// The Homestead landing page: a static site, deployed on Vercel with this folder as the project root.
export default defineConfig({ build: { outDir: 'dist', assetsInlineLimit: 0 } });
