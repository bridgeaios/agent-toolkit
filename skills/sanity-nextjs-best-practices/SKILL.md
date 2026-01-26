---
name: sanity-nextjs-best-practices
description: Next.js integration patterns for Sanity including data fetching (App Router & Pages Router), Visual Editing, TypeGen, images, page builders, and SEO. Use when building Next.js applications with Sanity CMS.
license: MIT
metadata:
  author: sanity
  version: "1.0.0"
---

# Sanity + Next.js Best Practices

Comprehensive patterns for building Next.js applications with Sanity CMS. Covers both App Router (Next.js 13+) and Pages Router patterns, with emphasis on type safety, Visual Editing, and performance.

## When to Apply

Reference these guidelines when:
- Setting up a new Next.js + Sanity project
- Implementing data fetching with `defineLive` or `getStaticProps`
- Configuring Visual Editing and the Presentation Tool
- Setting up TypeGen for type-safe queries
- Building reusable image components with `next/image`
- Creating Page Builder block rendering
- Implementing SEO metadata and sitemaps

## Architecture Options

### Embedded Studio (Recommended)
Studio lives inside your Next.js app at `/app/studio/[[...tool]]/page.tsx`.

```
your-project/
├── src/
│   ├── app/
│   │   └── studio/[[...tool]]/   # Embedded Studio
│   └── sanity/
│       ├── lib/
│       │   ├── client.ts
│       │   ├── live.ts
│       │   └── queries.ts
│       └── schemaTypes/
├── sanity.config.ts
└── sanity-typegen.json
```

### Monorepo (Alternative)
Studio and Next.js in separate packages. Requires CORS configuration.

```
your-project/
├── apps/
│   ├── studio/     # Sanity Studio
│   └── web/        # Next.js frontend
└── pnpm-workspace.yaml
```

## Rule Categories by Priority

| Priority | Category | Impact | Rule Files |
|----------|----------|--------|------------|
| 1 | Data Fetching | CRITICAL | `data-fetching-app-router.md`, `data-fetching-pages-router.md` |
| 2 | Visual Editing | HIGH | `visual-editing-setup.md`, `visual-editing-stega.md`, `visual-editing-presentation-queries.md` |
| 3 | TypeGen | HIGH | `typegen-workflow.md` |
| 4 | Images | MEDIUM | `images-nextjs.md` |
| 5 | Page Builder | MEDIUM | `page-builder-nextjs.md` |
| 6 | SEO | MEDIUM | `seo-metadata.md`, `seo-sitemap-og.md` |

## Quick Start Checklist

### App Router (Next.js 13+)

1. **Install dependencies**
   ```bash
   npm install next-sanity @sanity/image-url
   ```

2. **Set up client** (`src/sanity/lib/client.ts`)
   ```typescript
   import { createClient } from 'next-sanity'
   
   export const client = createClient({
     projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
     dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
     apiVersion: '2024-01-01',
     useCdn: true,
   })
   ```

3. **Set up defineLive** (`src/sanity/lib/live.ts`)
   ```typescript
   import { defineLive } from 'next-sanity/live'
   import { client } from './client'
   
   export const { sanityFetch, SanityLive } = defineLive({
     client: client.withConfig({ apiVersion: '2025-01-26' }),
     serverToken: process.env.SANITY_API_READ_TOKEN,
     browserToken: process.env.SANITY_API_READ_TOKEN,
   })
   ```

4. **Add SanityLive to layout** (`src/app/layout.tsx`)
   ```typescript
   import { SanityLive } from '@/sanity/lib/live'
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <SanityLive />
         </body>
       </html>
     )
   }
   ```

5. **Run TypeGen after schema changes**
   ```bash
   npm run typegen
   ```

### Pages Router

1. **Set up client with preview support**
2. **Configure `getStaticProps` with ISR**
3. **Set up Preview Mode API routes**
4. **Add preview toggle component**

See `rules/data-fetching-pages-router.md` for complete setup.

## App Router vs Pages Router

| Feature | App Router | Pages Router |
|---------|------------|--------------|
| Data fetching | `defineLive`, `sanityFetch` | `getStaticProps`, `getServerSideProps` |
| Preview/Draft | Draft Mode + `VisualEditing` | Preview Mode + custom component |
| Revalidation | Tag-based, path-based, time-based | ISR with `revalidate` |
| Real-time | Built into `defineLive` | Manual subscription setup |
| Recommended for | New projects | Legacy/migration |

## How to Use These Rules

Read individual rule files for detailed explanations and code examples:

```
rules/data-fetching-app-router.md
rules/visual-editing-setup.md
rules/typegen-workflow.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and edge cases
