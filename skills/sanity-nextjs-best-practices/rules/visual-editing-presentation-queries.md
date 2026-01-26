---
title: Presentation Queries for Faster Editing
description: Use usePresentationQuery to fetch only the block being edited for instant updates
tags: nextjs, visual-editing, presentation-queries, usePresentationQuery, performance
---

## Presentation Queries for Faster Editing

By default, editing a field in the Presentation Tool re-fetches the entire page query and re-renders all components. For pages with many blocks, this feels sluggish.

**Presentation queries** solve this by fetching only the specific block being edited.

### The Problem

Without optimization:
1. Editor changes a hero title
2. Entire page query re-runs
3. All components re-render (hero, features, FAQs, footer...)
4. Slow, janky experience

With presentation queries:
1. Editor changes a hero title
2. Only hero query re-runs
3. Only hero component re-renders
4. Fast, responsive experience

### Basic Pattern

**1. Create a block-specific query:**

```typescript
// src/sanity/lib/queries.ts
import { defineQuery } from 'next-sanity'

export const HERO_PRESENTATION_QUERY = defineQuery(`
  *[_id == $documentId][0]{
    _id,
    _type,
    "heroBlock": pageBuilder[_key == $blockKey && _type == "hero"][0]{
      title,
      subtitle,
      image,
      cta
    }
  }
`)
```

**2. Use `usePresentationQuery` in your component:**

```typescript
// src/components/Hero.tsx
'use client'
import { usePresentationQuery } from 'next-sanity/hooks'
import { HERO_PRESENTATION_QUERY } from '@/sanity/lib/queries'

type HeroProps = {
  _key: string
  documentId: string
  title: string
  subtitle?: string
  image?: any
  cta?: { label: string; url: string }
}

export function Hero({ _key, documentId, ...initialProps }: HeroProps) {
  // Fetch block-specific data for faster updates
  const { data } = usePresentationQuery({
    query: HERO_PRESENTATION_QUERY,
    params: { documentId, blockKey: _key },
  })

  // Use presentation data if available, fallback to initial server props
  const block = data?.heroBlock || initialProps

  return (
    <section className="py-20">
      <h1 className="text-5xl font-bold">{block.title}</h1>
      {block.subtitle && <p className="text-xl mt-4">{block.subtitle}</p>}
      {block.cta && (
        <a href={block.cta.url} className="btn mt-8">
          {block.cta.label}
        </a>
      )}
    </section>
  )
}
```

### Passing Document Context

Your page builder component must pass `documentId` to each block:

```typescript
// src/components/PageBuilder.tsx
import { Hero } from './Hero'
import { Features } from './Features'
import { FAQ } from './FAQ'

type Block = { _type: string; _key: string; [key: string]: any }

type PageBuilderProps = {
  content: Block[]
  documentId: string
}

export function PageBuilder({ content, documentId }: PageBuilderProps) {
  if (!Array.isArray(content)) return null

  return (
    <main>
      {content.map((block) => {
        // Pass documentId to each block
        const props = { ...block, documentId }

        switch (block._type) {
          case 'hero':
            return <Hero key={block._key} {...props} />
          case 'features':
            return <Features key={block._key} {...props} />
          case 'faq':
            return <FAQ key={block._key} {...props} />
          default:
            return (
              <div key={block._key} className="p-4 bg-yellow-100">
                Unknown block: {block._type}
              </div>
            )
        }
      })}
    </main>
  )
}
```

**In your page:**

```typescript
// src/app/[slug]/page.tsx
import { sanityFetch } from '@/sanity/lib/live'
import { PageBuilder } from '@/components/PageBuilder'
import { defineQuery } from 'next-sanity'

const PAGE_QUERY = defineQuery(`
  *[_type == "page" && slug.current == $slug][0]{
    _id,
    title,
    "content": pageBuilder[]{
      ...,
      _type == "hero" => { title, subtitle, image, cta },
      _type == "features" => { title, features[] },
      _type == "faq" => { title, items[]-> }
    }
  }
`)

export default async function Page({ params }) {
  const { data } = await sanityFetch({
    query: PAGE_QUERY,
    params: await params,
  })

  return (
    <PageBuilder 
      content={data.content} 
      documentId={data._id}  // Pass the document ID
    />
  )
}
```

### Presentation Query for Portable Text Blocks

The same pattern works for custom blocks inside Portable Text:

```typescript
// Query for a custom image block in the body
export const PTE_IMAGE_PRESENTATION_QUERY = defineQuery(`
  *[_id == $documentId][0]{
    "pteImageBlock": body[_key == $blockKey && _type == "pteImage"][0]{
      _key,
      image,
      caption,
      alt
    }
  }
`)
```

**Component:**

```typescript
'use client'
import { usePresentationQuery } from 'next-sanity/hooks'
import { PTE_IMAGE_PRESENTATION_QUERY } from '@/sanity/lib/queries'

export function PteImage({ value, documentId }: { value: any; documentId?: string }) {
  const { data } = usePresentationQuery({
    query: PTE_IMAGE_PRESENTATION_QUERY,
    params: { documentId, blockKey: value._key },
  })

  const block = data?.pteImageBlock || value

  return (
    <figure className="my-8">
      <SanityImage value={block.image} alt={block.alt} />
      {block.caption && (
        <figcaption className="text-sm text-gray-600 mt-2">
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
```

### When to Use Presentation Queries

| Scenario | Use Presentation Query? |
|----------|------------------------|
| Page with 5+ blocks | Yes |
| Complex nested data | Yes |
| Simple blog post | Optional |
| Static pages (no editing) | No |

### Performance Considerations

- Presentation queries only run in the Presentation Tool
- Outside the tool, components use initial server props
- The `usePresentationQuery` hook returns `undefined` outside presentation mode
- Always provide fallback to initial props: `data?.block || initialProps`

### Query Structure Tips

**Include all fields the component needs:**

```typescript
// Good: Complete block data
"heroBlock": pageBuilder[_key == $blockKey][0]{
  title,
  subtitle,
  image { asset->, alt, hotspot, crop },
  cta { label, url, style }
}

// Bad: Missing fields
"heroBlock": pageBuilder[_key == $blockKey][0]{
  title
  // Missing subtitle, image, cta!
}
```

**Match your page query projection:**

The presentation query should return the same shape as your page query for that block, so the component works identically with both data sources.

### Debugging

Check if presentation query is active:

```typescript
'use client'
import { usePresentationQuery, useIsPresentationTool } from 'next-sanity/hooks'

export function Hero({ _key, documentId, ...initialProps }) {
  const isPresentationTool = useIsPresentationTool()
  const { data, loading } = usePresentationQuery({
    query: HERO_PRESENTATION_QUERY,
    params: { documentId, blockKey: _key },
  })

  console.log({
    isPresentationTool,
    loading,
    hasData: !!data,
    usingInitialProps: !data,
  })

  const block = data?.heroBlock || initialProps
  // ...
}
```

Reference: [Optimizing Visual Editing Performance](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing)
