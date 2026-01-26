---
title: Page Builder Rendering in Next.js
description: Patterns for rendering page builder blocks with type safety and Visual Editing
tags: nextjs, page-builder, blocks, typescript, switch-rendering
---

## Page Builder Rendering in Next.js

Page builders are arrays of block objects that allow content teams to compose flexible page layouts. This guide covers rendering patterns for Next.js.

### Basic Switch Pattern

The most straightforward approach for rendering blocks:

```typescript
// src/components/PageBuilder.tsx
import { Hero } from './blocks/Hero'
import { Features } from './blocks/Features'
import { FAQ } from './blocks/FAQ'
import { CTA } from './blocks/CTA'

type Block = {
  _type: string
  _key: string
  [key: string]: any
}

type PageBuilderProps = {
  content: Block[]
  documentId?: string
}

export function PageBuilder({ content, documentId }: PageBuilderProps) {
  if (!Array.isArray(content)) return null

  return (
    <main>
      {content.map((block) => {
        switch (block._type) {
          case 'hero':
            return <Hero key={block._key} documentId={documentId} {...block} />
          case 'features':
            return <Features key={block._key} documentId={documentId} {...block} />
          case 'faq':
            return <FAQ key={block._key} documentId={documentId} {...block} />
          case 'cta':
            return <CTA key={block._key} documentId={documentId} {...block} />
          default:
            console.warn(`Unknown block type: ${block._type}`)
            return (
              <div key={block._key} className="p-4 bg-yellow-100 border border-yellow-400">
                Unknown block type: {block._type}
              </div>
            )
        }
      })}
    </main>
  )
}
```

### Always Use _key for React Keys

**Critical:** Always use Sanity's `_key` for React keys, never array index.

```typescript
// Bad: Breaks Visual Editing and causes hydration issues
{content.map((block, index) => (
  <Component key={index} {...block} />
))}

// Good: Stable keys from Sanity
{content.map((block) => (
  <Component key={block._key} {...block} />
))}
```

### TypeScript Typing with Extract

Use `Extract` to create typed props for each block component:

```typescript
// src/sanity/lib/types.ts
import type { PAGE_QUERYResult } from '@/sanity/types'

// Non-nullable content array
type ContentBlocks = NonNullable<NonNullable<PAGE_QUERYResult>['content']>

// Single block (union of all types)
type ContentBlock = ContentBlocks[number]

// Extract specific block types
export type HeroBlock = Extract<ContentBlock, { _type: 'hero' }>
export type FeaturesBlock = Extract<ContentBlock, { _type: 'features' }>
export type FAQBlock = Extract<ContentBlock, { _type: 'faq' }>
export type CTABlock = Extract<ContentBlock, { _type: 'cta' }>
```

**Use in components:**

```typescript
// src/components/blocks/Hero.tsx
import type { HeroBlock } from '@/sanity/lib/types'

type HeroProps = HeroBlock & {
  documentId?: string
}

export function Hero({ title, subtitle, image, cta, documentId }: HeroProps) {
  return (
    <section className="py-20 text-center">
      <h1 className="text-5xl font-bold">{title}</h1>
      {subtitle && <p className="text-xl mt-4 text-gray-600">{subtitle}</p>}
      {/* ... */}
    </section>
  )
}
```

### Block Registry Pattern

For larger projects, use a registry object instead of switch:

```typescript
// src/components/blocks/index.ts
import { Hero } from './Hero'
import { Features } from './Features'
import { FAQ } from './FAQ'
import { CTA } from './CTA'
import type { ComponentType } from 'react'

export const blockComponents: Record<string, ComponentType<any>> = {
  hero: Hero,
  features: Features,
  faq: FAQ,
  cta: CTA,
}
```

```typescript
// src/components/PageBuilder.tsx
import { blockComponents } from './blocks'

export function PageBuilder({ content, documentId }: PageBuilderProps) {
  return (
    <main>
      {content.map((block) => {
        const Component = blockComponents[block._type]
        
        if (!Component) {
          return <UnknownBlock key={block._key} type={block._type} />
        }
        
        return <Component key={block._key} documentId={documentId} {...block} />
      })}
    </main>
  )
}
```

### Cleaning Values for Logic

Use `stegaClean` when block fields control rendering logic:

```typescript
import { stegaClean } from 'next-sanity'

type SplitImageProps = {
  orientation?: string
  title: string
  image: any
}

export function SplitImage({ orientation, title, image }: SplitImageProps) {
  const cleanOrientation = stegaClean(orientation) || 'imageLeft'
  
  return (
    <section 
      className="flex" 
      data-orientation={cleanOrientation}
    >
      {cleanOrientation === 'imageLeft' ? (
        <>
          <ImageSection image={image} />
          <TextSection title={title} />
        </>
      ) : (
        <>
          <TextSection title={title} />
          <ImageSection image={image} />
        </>
      )}
    </section>
  )
}
```

### Alignment Utility

Common pattern for alignment fields:

```typescript
// src/lib/utils.ts
import { stegaClean } from 'next-sanity'

type Alignment = 'left' | 'center' | 'right'

export function getAlignmentClasses(align?: string): string {
  const clean = stegaClean(align) as Alignment | undefined
  
  switch (clean) {
    case 'left':
      return 'text-left'
    case 'right':
      return 'text-right ml-auto'
    case 'center':
    default:
      return 'text-center mx-auto'
  }
}
```

### Querying Page Builder Content

Expand nested content and references:

```typescript
const PAGE_QUERY = defineQuery(`
  *[_type == "page" && slug.current == $slug][0]{
    _id,
    title,
    content[]{
      ...,
      _type == "hero" => {
        title,
        subtitle,
        image { ${imageFragment} },
        cta { label, url }
      },
      _type == "features" => {
        title,
        features[]{
          _key,
          title,
          description,
          icon
        }
      },
      _type == "faq" => {
        title,
        items[]->{ _id, question, answer }
      }
    }
  }
`)
```

### Page Component

```typescript
// src/app/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { sanityFetch } from '@/sanity/lib/live'
import { PageBuilder } from '@/components/PageBuilder'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  
  const { data } = await sanityFetch({
    query: PAGE_QUERY,
    params: { slug },
  })

  if (!data) notFound()

  return (
    <PageBuilder 
      content={data.content} 
      documentId={data._id}
    />
  )
}
```

### Semantic Heading Levels

Don't store heading levels in Sanity. Determine them dynamically for accessibility:

```typescript
// Bad: Heading level in CMS
{ name: 'headingLevel', type: 'string', options: { list: ['h1', 'h2', 'h3'] } }

// Good: Pass level as prop based on context
type SectionProps = {
  title: string
  headingLevel?: 'h1' | 'h2' | 'h3'
}

export function Section({ title, headingLevel = 'h2' }: SectionProps) {
  const Tag = headingLevel
  return <Tag className="text-3xl font-bold">{title}</Tag>
}
```

In PageBuilder:

```typescript
{content.map((block, index) => {
  // First block gets h1, others get h2
  const headingLevel = index === 0 ? 'h1' : 'h2'
  
  switch (block._type) {
    case 'hero':
      return <Hero key={block._key} headingLevel={headingLevel} {...block} />
    // ...
  }
})}
```

### Error Boundaries

Wrap page builder in error boundary for resilience:

```typescript
'use client'
import { ErrorBoundary } from 'react-error-boundary'

function BlockErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <p className="text-red-700">Failed to render block</p>
      <button onClick={resetErrorBoundary} className="text-sm underline">
        Try again
      </button>
    </div>
  )
}

export function PageBuilder({ content, documentId }) {
  return (
    <main>
      {content.map((block) => (
        <ErrorBoundary 
          key={block._key} 
          FallbackComponent={BlockErrorFallback}
        >
          <BlockRenderer block={block} documentId={documentId} />
        </ErrorBoundary>
      ))}
    </main>
  )
}
```

Reference: [Page Builder patterns](https://www.sanity.io/guides/how-to-build-a-page-builder-in-sanity-studio)
