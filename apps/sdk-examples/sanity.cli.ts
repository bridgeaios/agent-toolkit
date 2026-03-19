import { defineCliConfig } from "sanity/cli";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";

export default defineCliConfig({
  app: {
    entry: "./src/App.tsx",
    organizationId: "oblZgbTFj",
  },
  vite: (config) => ({
    ...config,
    // enforce: 'pre' is required — MDX must transform before @vitejs/plugin-react
    // (Sanity CLI internally registers @vitejs/plugin-react)
    plugins: [
      ...(config.plugins ?? []),
      // enforce placed AFTER spread so it is not overwritten by any key from mdx()
      {
        ...mdx({ remarkPlugins: [remarkGfm, remarkFrontmatter] }),
        enforce: "pre" as const,
      },
    ],
  }),
});
