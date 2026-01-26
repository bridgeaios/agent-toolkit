# Section Definitions

This file defines the rule categories for Sanity + Next.js best practices. Rules are automatically assigned to sections based on their filename prefix.

---

## 1. Data Fetching (data-)
Query patterns, caching strategies, and revalidation for both App Router and Pages Router. The foundation for all Sanity + Next.js applications.

**App Router:** `defineLive`, `sanityFetch`, tag-based revalidation, webhooks
**Pages Router:** `getStaticProps`, `getServerSideProps`, ISR, Preview Mode

## 2. Visual Editing (visual-)
Presentation Tool setup, Content Source Maps (Stega), draft mode, and click-to-edit overlays. Critical for editor experience.

**Key concepts:** Draft Mode, `VisualEditing` component, `stegaClean`, presentation queries

## 3. TypeGen (typegen-)
Type generation from schema and GROQ queries. Ensures type safety across the entire application.

**Key concepts:** `defineQuery`, `sanity typegen generate`, result type inference

## 4. Images (images-)
Image handling with `next/image`, Sanity URL builder, LQIP placeholders, and hotspot support.

**Key concepts:** `urlFor`, `SanityImage` component, blur placeholders, responsive images

## 5. Page Builder (page-)
Block-based page composition, component rendering patterns, and TypeScript typing for flexible layouts.

**Key concepts:** Switch rendering, `Extract` type pattern, `_key` for React keys

## 6. SEO (seo-)
Metadata generation, sitemaps, Open Graph images, and search engine optimization patterns.

**Key concepts:** `generateMetadata`, `stega: false`, dynamic sitemaps, canonical URLs
