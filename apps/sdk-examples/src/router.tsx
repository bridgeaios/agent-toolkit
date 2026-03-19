import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";

// Eagerly import all .tsx and .mdx files under src/routes/
// This is resolved at build time by Vite — no runtime filesystem access.
const modules = import.meta.glob("./routes/**/*.{tsx,mdx}", { eager: true });

function pathToRoute(filePath: string): string {
  return (
    filePath
      .replace("./routes", "")
      .replace(/\/index\.(tsx|mdx)$/, "") // /examples/index.tsx → /examples
      .replace(/\.(tsx|mdx)$/, "")
      .replace(/\/not-found$/, "*") || // not-found.tsx → catch-all
    "/" // root index.tsx → /
  );
}

export const router = createBrowserRouter(
  Object.entries(modules)
    .filter(([path]) => !path.includes("/_")) // skip _layout files
    .filter(([, mod]) => !!(mod as { default?: unknown }).default) // skip files with no default export
    .map(([path, mod]) => ({
      path: pathToRoute(path),
      Component: (mod as { default: ComponentType }).default,
    }))
);
