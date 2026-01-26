---
title: App Router Data Fetching with defineLive
description: Use defineLive for real-time content updates and Visual Editing in Next.js App Router
tags: nextjs, app-router, data-fetching, defineLive, caching, revalidation
---

## App Router Data Fetching with defineLive

The `defineLive` function from `next-sanity` (v11+) is the recommended way to fetch Sanity content in Next.js App Router. It handles real-time updates, Visual Editing, and caching automatically.

### Basic Setup

**1. Create the live configuration (`src/sanity/lib/live.ts`):**

```typescript
import { defineLive } from 'next-sanity/live'
import { client } from './client'

export const { sanityFetch, SanityLive } = defineLive({
  client: client.withConfig({ apiVersion: '2025-01-26' }),
  serverToken: process.env.SANITY_API_READ_TOKEN,
  browserToken: process.env.SANITY_API_READ_TOKEN,
})
```

**2. Add SanityLive to root layout (`src/app/layout.tsx`):**

```typescript
import { SanityLive } from '@/sanity/lib/live'
import { VisualEditing } from 'next-sanity/visual-editing'
import { draftMode } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SanityLive />
        {(await draftMode()).isEnabled && <VisualEditing />}
      </body>
    </html>
  )
}
```

**3. Fetch data in pages/components:**

```typescript
import { sanityFetch } from '@/sanity/lib/live'
import { defineQuery } from 'next-sanity'

const POSTS_QUERY = defineQuery(`*[_type == "post"] | order(publishedAt desc)[0...10]{
  _id, title, "slug": slug.current, publishedAt
}`)

export default async function BlogPage() {
  const { data: posts } = await sanityFetch({ query: POSTS_QUERY })
  
  return (
    <ul>
      {posts.map(post => (
        <li key={post._id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Caching Strategies

**Prefer `defineLive` by default.** It handles caching and invalidation automatically. Only use manual caching when you need fine-grained control.

| Scenario | Approach |
|----------|----------|
| Real-time updates, Visual Editing | `defineLive` (default) |
| Static marketing pages | Time-based revalidation |
| Blog posts, products | Tag-based revalidation |
| Critical accuracy (prices) | Path-based + short revalidation |

### Manual sanityFetch Helper (Advanced)

For manual caching control, create a wrapper:

```typescript
// src/sanity/lib/fetch.ts
import { client } from './client'
import type { QueryParams } from 'next-sanity'

export async function sanityFetch<const QueryString extends string>({
  query,
  params = {},
  revalidate = 60,
  tags = [],
}: {
  query: QueryString
  params?: QueryParams
  revalidate?: number | false
  tags?: string[]
}) {
  return client.fetch(query, params, {
    next: {
      revalidate: tags.length ? false : revalidate,
      tags,
    },
  })
}
```

### Time-Based Revalidation

Simple and predictable. Good for content that changes infrequently.

```typescript
const posts = await sanityFetch({
  query: POSTS_QUERY,
  revalidate: 3600, // Revalidate every hour
})
```

### Tag-Based Revalidation

"Update once, revalidate everywhere" - best for referenced content.

**1. Tag your queries:**

```typescript
const posts = await sanityFetch({
  query: POSTS_QUERY,
  tags: ['post', 'author', 'category'],
})

const post = await sanityFetch({
  query: POST_QUERY,
  params,
  tags: [`post:${params.slug}`, 'author', 'category'],
})
```

**2. Create webhook API route (`src/app/api/revalidate/tag/route.ts`):**

```typescript
import { revalidateTag } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { parseBody } from 'next-sanity/webhook'

type WebhookPayload = { tags: string[] }

export async function POST(req: NextRequest) {
  try {
    const { isValidSignature, body } = await parseBody<WebhookPayload>(
      req,
      process.env.SANITY_REVALIDATE_SECRET,
      true // Add delay to allow CDN to update
    )

    if (!isValidSignature) {
      return new Response('Invalid signature', { status: 401 })
    }
    if (!Array.isArray(body?.tags) || !body.tags.length) {
      return new Response('Missing tags', { status: 400 })
    }

    body.tags.forEach((tag) => revalidateTag(tag))
    return NextResponse.json({ revalidated: body.tags })
  } catch (err) {
    return new Response((err as Error).message, { status: 500 })
  }
}
```

**3. Create GROQ-Powered Webhook in Sanity:**
- URL: `https://yoursite.com/api/revalidate/tag`
- Filter: `_type in ["post", "author", "category"]`
- Projection: `{ "tags": [_type, _type + ":" + slug.current] }`

### Path-Based Revalidation

Surgically revalidate specific routes when documents change.

```typescript
// src/app/api/revalidate/path/route.ts
import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { parseBody } from 'next-sanity/webhook'

type WebhookPayload = { path?: string }

export async function POST(req: NextRequest) {
  try {
    const { isValidSignature, body } = await parseBody<WebhookPayload>(
      req,
      process.env.SANITY_REVALIDATE_SECRET,
      true
    )

    if (!isValidSignature) {
      return new Response('Invalid signature', { status: 401 })
    }
    if (!body?.path) {
      return new Response('Missing path', { status: 400 })
    }

    revalidatePath(body.path)
    return NextResponse.json({ revalidated: body.path })
  } catch (err) {
    return new Response((err as Error).message, { status: 500 })
  }
}
```

### Sanity CDN vs API

| Setting | Speed | Freshness | Use When |
|---------|-------|-----------|----------|
| `useCdn: true` | Fast | May have brief delay | Default for runtime fetches |
| `useCdn: false` | Slower | Guaranteed fresh | `generateStaticParams`, webhooks |

Override per-request for static generation:

```typescript
export async function generateStaticParams() {
  const slugs = await client
    .withConfig({ useCdn: false })
    .fetch(SLUGS_QUERY)
  return slugs
}
```

### Debugging: Enable Fetch Logging

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}
```

Console output shows cache status:
```
GET /posts 200 in 39ms
 | GET https://...apicdn.sanity.io/... 200 in 5ms (cache hit)
```

### Stale Data After Webhook?

Webhooks fire *before* Sanity CDN updates. If you see stale data:

1. **Add delay** - Pass `true` as third arg to `parseBody`
2. **Or bypass CDN** - Set `useCdn: false` (use sparingly)

### Pagination Pattern

```typescript
const ARTICLES_QUERY = defineQuery(`
  *[_type == "article" && defined(slug.current)] 
  | order(date desc) [$start...$end] {
    _id, title, "slug": slug.current, date
  }
`)

const ARTICLES_COUNT_QUERY = defineQuery(`
  count(*[_type == "article" && defined(slug.current)])
`)

export default async function BlogPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ page?: string }> 
}) {
  const { page: pageParam } = await searchParams
  const page = parseInt(pageParam || "1")
  const start = (page - 1) * 10
  const end = start + 10

  const [{ data: articles }, { data: total }] = await Promise.all([
    sanityFetch({ query: ARTICLES_QUERY, params: { start, end } }),
    sanityFetch({ query: ARTICLES_COUNT_QUERY })
  ])

  return <ArticleList articles={articles} total={total} page={page} />
}
```

Reference: [next-sanity documentation](https://github.com/sanity-io/next-sanity)
