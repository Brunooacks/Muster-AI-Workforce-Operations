import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT/BASE_PATH are injected by Replit for its managed dev/preview server.
// Off-Replit (a static `vite build` on Vercel/Netlify/CI) they're absent, so
// default gracefully — a production build must never depend on them. When
// Replit provides them they still take effect for the dev/preview server.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Local dev auth bypass: swap @clerk/react for a signed-in mock so the app
// runs on localhost without a Clerk project. Pair with AUTH_DEV_BYPASS=true
// on the API server. Never active in a production build — the flag must be
// set explicitly in the dev environment.
const authDevBypass = process.env.VITE_AUTH_DEV_BYPASS === "true";
const clerkMockPath = path.resolve(import.meta.dirname, "src/dev/clerk-mock.tsx");

// Where the local API server listens; the dev server proxies /api to it so the
// SPA can use same-origin requests exactly like in production.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      ...(authDevBypass
        ? {
            "@clerk/react/internal": clerkMockPath,
            "@clerk/react": clerkMockPath,
          }
        : {}),
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
