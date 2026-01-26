---
title: Stega Clean for Logic Operations
description: Use stegaClean() before string comparisons, object lookups, or metadata
tags: nextjs, visual-editing, stega, stegaClean, metadata, seo
---

## Stega Clean for Logic Operations

When Visual Editing is enabled, Sanity injects invisible characters (Stega) into string fields. These characters enable click-to-edit but **break string comparisons and lookups**.

### The Golden Rule

**Clean before logic, preserve for display.**

| Use Case | Clean? | Why |
|----------|--------|-----|
| String comparison (`if (x === 'y')`) | Yes | Stega breaks equality |
| Object key lookup (`map[value]`) | Yes | Keys won't match |
| HTML IDs/attributes | Yes | Invalid characters |
| CSS class mapping | Yes | Lookups fail |
| Third-party APIs | Yes | May validate input |
| Rendering text (`<h1>{title}</h1>`) | No | Breaks click-to-edit |
| Passing to `<PortableText />` | No | Handles internally |
| Image URL helpers | No | Handles internally |

### Import stegaClean

```typescript
// From next-sanity (recommended for Next.js)
import { stegaClean } from 'next-sanity'

// Or from @sanity/client
import { stegaClean } from '@sanity/client/stega'
```

### Pattern: String Comparisons

**Incorrect (comparison fails):**

```typescript
function Layout({ align }: { align: string }) {
  // This will NEVER match because align contains invisible characters
  if (align === 'center') {
    return <div className="mx-auto">...</div>
  }
  return <div>...</div>
}
```

**Correct (clean first):**

```typescript
import { stegaClean } from 'next-sanity'

function Layout({ align }: { align: string }) {
  const cleanAlign = stegaClean(align)
  
  return (
    <div className={cleanAlign === 'center' ? 'mx-auto' : ''}>
      ...
    </div>
  )
}
```

### Pattern: Object Key Lookups

**Incorrect (lookup returns undefined):**

```typescript
const colorMap = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
}

function Card({ color }: { color: string }) {
  // color = "red" + invisible stega chars -> lookup fails
  return <div className={colorMap[color]}>...</div>
}
```

**Correct (clean before lookup):**

```typescript
import { stegaClean } from 'next-sanity'

function Card({ color }: { color: string }) {
  const cleanColor = stegaClean(color)
  return <div className={colorMap[cleanColor] || 'bg-gray-500'}>...</div>
}
```

### Pattern: Switch Statements

```typescript
import { stegaClean } from 'next-sanity'

function Icon({ name }: { name: string }) {
  switch (stegaClean(name)) {
    case 'arrow':
      return <ArrowIcon />
    case 'check':
      return <CheckIcon />
    default:
      return null
  }
}
```

### Critical: SEO Metadata

**Never** let Stega characters into `<head>` tags. They will appear in search results and break SEO.

**Incorrect (stega in metadata):**

```typescript
export async function generateMetadata({ params }) {
  const { data } = await sanityFetch({
    query: PAGE_QUERY,
    params: await params,
    // Stega is ON by default!
  })
  
  // Title will contain invisible characters!
  return { title: data.title }
}
```

**Correct (disable stega for metadata):**

```typescript
export async function generateMetadata({ params }) {
  const { data } = await sanityFetch({
    query: PAGE_QUERY,
    params: await params,
    stega: false, // Disable stega for metadata
  })
  
  return { 
    title: data.title,
    description: data.description,
  }
}
```

### Critical: Static Params

When generating static params, disable stega and use published perspective:

```typescript
export async function generateStaticParams() {
  const { data } = await sanityFetch({
    query: SLUGS_QUERY,
    perspective: 'published', // No drafts
    stega: false,             // No stega encoding
  })
  
  return data.map((slug) => ({ slug }))
}
```

### Pattern: Data Attributes

HTML data attributes used for styling or JS logic:

```typescript
import { stegaClean } from 'next-sanity'

function Section({ theme }: { theme: string }) {
  return (
    <section data-theme={stegaClean(theme)}>
      {/* CSS: [data-theme="dark"] { ... } */}
    </section>
  )
}
```

### Pattern: URL Construction

```typescript
import { stegaClean } from 'next-sanity'

function ExternalLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={stegaClean(url)}>
      {label} {/* Keep stega for click-to-edit on label */}
    </a>
  )
}
```

### Pattern: Conditional Rendering

```typescript
import { stegaClean } from 'next-sanity'

function Feature({ enabled, title }: { enabled: string; title: string }) {
  // Clean boolean-like strings
  if (stegaClean(enabled) !== 'true') {
    return null
  }
  
  return <h2>{title}</h2> // Keep stega in rendered text
}
```

### Utility Function

Create a reusable utility for common patterns:

```typescript
// src/lib/utils.ts
import { stegaClean } from 'next-sanity'

type AlignValue = 'left' | 'center' | 'right'

export function getAlignClass(align?: string): string {
  const clean = stegaClean(align) as AlignValue | undefined
  
  const alignMap: Record<AlignValue, string> = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  }
  
  return alignMap[clean || 'left']
}
```

### When NOT to Clean

Keep stega characters when rendering visible text:

```typescript
function Hero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section>
      {/* DO NOT clean - stega enables click-to-edit */}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </section>
  )
}
```

If you clean rendered text, editors lose the ability to click on it to edit.

Reference: [Content Source Maps](https://www.sanity.io/docs/visual-editing/content-source-maps)
