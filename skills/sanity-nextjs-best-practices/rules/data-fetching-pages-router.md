---
title: Pages Router Data Fetching
description: Patterns for getStaticProps, ISR, and Preview Mode in Next.js Pages Router
tags: nextjs, pages-router, data-fetching, getStaticProps, ISR, preview-mode
---

## Pages Router Data Fetching

For Next.js Pages Router projects, use `getStaticProps` with ISR (Incremental Static Regeneration) and Preview Mode for draft content.

### Client Setup

```typescript
// src/sanity/lib/client.ts
import { createClient } from 'next-sanity'

const config = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: process.env.NODE_ENV === 'production',
}

export const client = createClient(config)

// Preview client with token (server-side only)
export const previewClient = createClient({
  ...config,
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN,
})

// Helper to get appropriate client
export const getClient = (preview?: boolean) => 
  preview ? previewClient : client
```

### Basic getStaticProps Pattern

```typescript
// pages/blog/[slug].tsx
import { client, getClient } from '@/sanity/lib/client'
import { defineQuery } from 'groq'

const POST_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    body,
    "slug": slug.current,
    publishedAt,
    author->{ name, image }
  }
`)

const SLUGS_QUERY = defineQuery(`
  *[_type == "post" && defined(slug.current)][].slug.current
`)

export async function getStaticPaths() {
  const slugs = await client.fetch(SLUGS_QUERY)
  
  return {
    paths: slugs.map((slug: string) => ({ params: { slug } })),
    fallback: 'blocking', // Generate new pages on-demand
  }
}

export async function getStaticProps({ params, preview = false }) {
  const post = await getClient(preview).fetch(POST_QUERY, { 
    slug: params.slug 
  })

  if (!post) {
    return { notFound: true }
  }

  return {
    props: { post, preview },
    revalidate: 60, // ISR: revalidate every 60 seconds
  }
}

export default function PostPage({ post, preview }) {
  return (
    <>
      {preview && <PreviewBanner />}
      <article>
        <h1>{post.title}</h1>
        {/* ... */}
      </article>
    </>
  )
}
```

### ISR (Incremental Static Regeneration)

ISR allows you to update static pages after deployment without rebuilding the entire site.

```typescript
export async function getStaticProps({ params }) {
  const data = await client.fetch(QUERY, params)

  return {
    props: { data },
    revalidate: 60, // Revalidate at most every 60 seconds
  }
}
```

**ISR strategies:**

| Content Type | Revalidate | Rationale |
|--------------|------------|-----------|
| Homepage | 60 | Frequently updated, should feel fresh |
| Blog posts | 300 | Updates less often, 5 min acceptable |
| Legal pages | 3600 | Rarely changes, 1 hour fine |
| Product pages | 60 | Prices/stock may change |

### On-Demand Revalidation

Trigger revalidation via webhook when content changes in Sanity.

**API Route (`pages/api/revalidate.ts`):**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'

const secret = process.env.SANITY_REVALIDATE_SECRET!

type SanityWebhookBody = {
  _type: string
  slug?: { current: string }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const signature = req.headers[SIGNATURE_HEADER_NAME] as string
  const body = await readBody(req)

  if (!isValidSignature(body, signature, secret)) {
    return res.status(401).json({ message: 'Invalid signature' })
  }

  const { _type, slug } = JSON.parse(body) as SanityWebhookBody

  try {
    // Revalidate specific paths based on document type
    if (_type === 'post' && slug?.current) {
      await res.revalidate(`/blog/${slug.current}`)
      await res.revalidate('/blog') // Also revalidate listing
    }
    
    if (_type === 'page' && slug?.current) {
      await res.revalidate(`/${slug.current}`)
    }

    // Always revalidate homepage
    await res.revalidate('/')

    return res.json({ revalidated: true })
  } catch (err) {
    return res.status(500).json({ message: 'Error revalidating' })
  }
}

// Helper to read raw body
async function readBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export const config = {
  api: { bodyParser: false },
}
```

### Preview Mode Setup

Preview Mode lets editors see draft content before publishing.

**1. Enable Preview API Route (`pages/api/preview.ts`):**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { previewClient } from '@/sanity/lib/client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { secret, slug, type } = req.query

  // Validate secret
  if (secret !== process.env.SANITY_PREVIEW_SECRET) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  // Validate document exists
  if (!slug || !type) {
    return res.status(400).json({ message: 'Missing slug or type' })
  }

  // Check document exists in Sanity
  const exists = await previewClient.fetch(
    `*[_type == $type && slug.current == $slug][0]._id`,
    { type, slug }
  )

  if (!exists) {
    return res.status(404).json({ message: 'Document not found' })
  }

  // Enable Preview Mode
  res.setPreviewData({})

  // Redirect to the document's page
  const redirectUrl = type === 'post' ? `/blog/${slug}` : `/${slug}`
  res.redirect(redirectUrl)
}
```

**2. Disable Preview API Route (`pages/api/exit-preview.ts`):**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.clearPreviewData()
  res.redirect(req.headers.referer || '/')
}
```

**3. Preview Banner Component:**

```typescript
// components/PreviewBanner.tsx
export function PreviewBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-400 p-2 text-center z-50">
      <span className="font-bold">Preview Mode</span>
      {' - '}
      <a href="/api/exit-preview" className="underline">
        Exit Preview
      </a>
    </div>
  )
}
```

**4. Use in pages:**

```typescript
export async function getStaticProps({ params, preview = false, previewData }) {
  const client = getClient(preview)
  
  // In preview mode, fetch drafts
  const perspective = preview ? 'previewDrafts' : 'published'
  
  const post = await client.fetch(
    POST_QUERY,
    { slug: params.slug },
    { perspective }
  )

  return {
    props: { post, preview },
    revalidate: preview ? 1 : 60, // Fast revalidation in preview
  }
}
```

### Fetching Draft Content

In Preview Mode, you want to see unpublished changes:

```typescript
// Fetch with draft perspective
const post = await previewClient.fetch(
  QUERY,
  params,
  { perspective: 'previewDrafts' }
)
```

The `previewDrafts` perspective:
- Returns draft versions if they exist
- Falls back to published versions
- Requires a token with read access

### Real-Time Preview (Optional)

For live updates as editors type, use `@sanity/preview-kit`:

```typescript
// pages/blog/[slug].tsx
import { usePreview } from '@/sanity/lib/preview'

export default function PostPage({ post, preview }) {
  // In preview mode, subscribe to real-time updates
  const livePost = usePreview(preview, POST_QUERY, { slug: post.slug })
  const data = livePost || post

  return (
    <>
      {preview && <PreviewBanner />}
      <article>
        <h1>{data.title}</h1>
      </article>
    </>
  )
}
```

**Preview hook setup:**

```typescript
// src/sanity/lib/preview.ts
import { definePreview } from '@sanity/preview-kit'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!

export const usePreview = definePreview({ projectId, dataset })
```

### getServerSideProps (When to Use)

Use `getServerSideProps` only when you need:
- Request-time data (user session, cookies)
- Data that changes on every request
- Personalized content

```typescript
export async function getServerSideProps({ req, params }) {
  // Access cookies/headers
  const userToken = req.cookies.token
  
  const data = await client.fetch(QUERY, { 
    ...params,
    userId: userToken ? decodeToken(userToken).userId : null 
  })

  return { props: { data } }
}
```

**Avoid `getServerSideProps` for:**
- Public content (use `getStaticProps` + ISR)
- SEO-critical pages (SSG is faster)

### Migration to App Router

When ready to migrate:

1. **Move pages incrementally** - Both routers can coexist
2. **Replace `getStaticProps`** with `sanityFetch` + `defineLive`
3. **Replace Preview Mode** with Draft Mode
4. **Replace ISR `revalidate`** with tag-based revalidation

See `data-fetching-app-router.md` for App Router patterns.

Reference: [Next.js Pages Router docs](https://nextjs.org/docs/pages)
