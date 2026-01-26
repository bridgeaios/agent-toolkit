---
title: TypeGen Workflow
description: Generate TypeScript types from Sanity schema and GROQ queries
tags: nextjs, typescript, typegen, defineQuery, type-safety
---

## TypeGen Workflow

Sanity TypeGen generates TypeScript types from your schema and GROQ queries. This ensures type safety across your entire application.

### The Workflow

1. **Extract**: Convert schema (TS/JS) to static JSON
2. **Generate**: Scan codebase for `defineQuery` calls, generate types

Run this cycle whenever schema or queries change.

### Setup

**1. Create config file (`sanity-typegen.json`):**

```json
{
  "path": "./src/**/*.{ts,tsx,js,jsx}",
  "schema": "./schema.json",
  "generates": "./src/sanity/types.ts"
}
```

**2. Add npm scripts (`package.json`):**

```json
{
  "scripts": {
    "typegen": "sanity schema extract --path=./schema.json && sanity typegen generate",
    "predev": "npm run typegen",
    "prebuild": "npm run typegen"
  }
}
```

**3. Run TypeGen:**

```bash
npm run typegen
```

### Always Use defineQuery

**Wrap ALL GROQ queries in `defineQuery`** for TypeGen support.

**Incorrect (no types):**

```typescript
// No TypeGen support, result is `any`
const query = `*[_type == "post"]{ title, slug }`
const posts = await client.fetch(query)
// posts: any
```

**Correct (with defineQuery):**

```typescript
import { defineQuery } from 'next-sanity'

// TypeGen generates POST_QUERYResult type automatically
const POST_QUERY = defineQuery(`*[_type == "post"]{ title, slug }`)

// After running `npm run typegen`:
import type { POST_QUERYResult } from '@/sanity/types'

const { data } = await sanityFetch({ query: POST_QUERY })
// data is fully typed!
```

### Syntax Highlighting

For VS Code syntax highlighting with `defineQuery`:

```typescript
// Option A: groq tagged template (provides highlighting)
import groq from 'groq'
const QUERY = defineQuery(groq`*[_type == "post"]`)

// Option B: Comment prefix
const QUERY = defineQuery(/* groq */ `*[_type == "post"]`)

// Option C: Just defineQuery (TypeGen works, no highlighting)
const QUERY = defineQuery(`*[_type == "post"]`)
```

### Using Generated Types

**Never manually type query results.** Infer from the query:

```typescript
import { defineQuery } from 'next-sanity'
import type { POST_QUERYResult } from '@/sanity/types'

const POST_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    body,
    author->{ name, image }
  }
`)

// In components
type PostProps = {
  data: NonNullable<POST_QUERYResult>
}

export function Post({ data }: PostProps) {
  return (
    <article>
      <h1>{data.title}</h1>
      <p>By {data.author?.name}</p>
    </article>
  )
}
```

### Query Fragments

Use string interpolation to reuse query logic:

```typescript
// src/sanity/lib/fragments.ts
export const imageFragment = /* groq */ `
  asset->{
    _id,
    url,
    metadata { lqip, dimensions }
  },
  alt,
  hotspot,
  crop
`

export const authorFragment = /* groq */ `
  name,
  "slug": slug.current,
  image { ${imageFragment} }
`
```

```typescript
// src/sanity/lib/queries.ts
import { defineQuery } from 'next-sanity'
import { imageFragment, authorFragment } from './fragments'

export const POST_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    mainImage { ${imageFragment} },
    author->{ ${authorFragment} },
    body
  }
`)
```

### Monorepo Configuration

For monorepos with separate studio and frontend:

**`apps/web/sanity-typegen.json`:**

```json
{
  "path": "./src/**/*.{ts,tsx}",
  "schema": "../studio/schema.json",
  "generates": "./src/sanity/types.ts"
}
```

**Extract schema from studio:**

```bash
cd apps/studio && npx sanity schema extract --path=./schema.json
```

### Typing Page Builder Blocks

Use `Extract` to type individual blocks from query results:

```typescript
import type { PAGE_QUERYResult } from '@/sanity/types'

// Extract a specific block type
type HeroBlock = Extract<
  NonNullable<NonNullable<PAGE_QUERYResult>['content']>[number],
  { _type: 'hero' }
>

// Now HeroBlock has: title, subtitle, image, etc.
export function Hero(props: HeroBlock) {
  return <h1>{props.title}</h1>
}
```

### Git Strategy

**Option A: Commit generated types (recommended for most teams)**

```gitignore
# Don't ignore - commit types
# sanity.types.ts
```

Pros:
- Types available immediately after `git pull`
- CI doesn't need to run typegen

Cons:
- Can cause merge conflicts

**Option B: Generate in CI (larger teams)**

```gitignore
# Sanity TypeGen (generated)
sanity.types.ts
schema.json
```

CI config:

```yaml
- run: npm run typegen
- run: npm run build
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Types not updating | Run `npm run typegen` after changes |
| Query not found | Ensure query uses `defineQuery()` |
| Schema not found | Run `sanity schema extract` first |
| TS errors after schema change | Restart TS server in VS Code |
| Monorepo path issues | Check `schema` path in config |

### Development Workflow

1. Modify schema (`schemaTypes/...`)
2. Modify queries (`queries.ts`)
3. Run `npm run typegen`
4. If VS Code shows stale types, restart TS server (Cmd+Shift+P > "Restart TS Server")

### Type Helpers

Create utility types for common patterns:

```typescript
// src/sanity/lib/types.ts
import type { 
  PAGE_QUERYResult,
  POST_QUERYResult 
} from '@/sanity/types'

// Non-nullable page data
export type PageData = NonNullable<PAGE_QUERYResult>

// Content blocks array
export type ContentBlocks = NonNullable<PageData['content']>

// Single block union type
export type ContentBlock = ContentBlocks[number]

// Extract specific block
export type HeroBlock = Extract<ContentBlock, { _type: 'hero' }>
export type FeaturesBlock = Extract<ContentBlock, { _type: 'features' }>
```

Reference: [Sanity TypeGen](https://www.sanity.io/docs/sanity-typegen)
