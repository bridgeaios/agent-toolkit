# Sanity Best Practices

Version: 1.0.0 | Author: Sanity | Date: February 2026

> This guide targets AI agents and LLMs working with Sanity codebases. It contains 26 rules across 10 categories, prioritized by impact.

## Table of Contents

1. [GROQ Performance (CRITICAL)](#1-groq-performance)
2. [Schema Design (HIGH)](#2-schema-design)
3. [Visual Editing (HIGH)](#3-visual-editing)
4. [Images (HIGH)](#4-images)
5. [Portable Text (HIGH)](#5-portable-text)
6. [Page Builder (MEDIUM)](#6-page-builder)
7. [Studio Configuration (MEDIUM)](#7-studio-configuration)
8. [TypeGen (MEDIUM)](#8-typegen)
9. [Localization (MEDIUM)](#9-localization)
10. [Migration (LOW-MEDIUM)](#10-migration)

---

## 1. GROQ Performance

Query optimization, index usage, and performance patterns. Covers optimizable filters, avoiding joins in filters, cursor pagination, and projection best practices.

### 1.1 Use Optimizable Filters First

GROQ uses indexes for **optimizable** filters. Non-optimizable filters scan ALL documents, causing severe performance degradation on large datasets.

**Incorrect (scans everything):**

```groq
// Comparing two attributes - cannot use index
*[salePrice < displayPrice]

// Join in filter - expensive reference resolution
*[author->name == "Bob Woodward"]
```

**Correct (uses indexes):**

```groq
// Stack optimizable filters FIRST to reduce search space
*[_type == "product" && defined(salePrice) && salePrice < displayPrice]

// Use _ref for direct comparison (no resolution needed)
*[_type == "post" && author._ref == "author-bob-woodward-id"]
```

#### Optimizable Filter Patterns

| Pattern | Optimizable | Example |
|---------|-------------|---------|
| `_type == "x"` | Yes | `*[_type == "post"]` |
| `_id == "x"` | Yes | `*[_id == "abc123"]` |
| `slug.current == $slug` | Yes | `*[slug.current == "hello"]` |
| `defined(field)` | Yes | `*[defined(publishedAt)]` |
| `references($id)` | Yes | `*[references("author-123")]` |
| `field->attr == x` | No | Resolves reference for every doc |
| `fieldA < fieldB` | No | Compares two attributes |

Reference: [High Performance GROQ](https://www.sanity.io/docs/developer-guides/high-performance-groq)

### 1.2 Avoid Joins in Filters

Reference resolution (`->`) in filters is expensive because it must resolve the reference for every document being filtered. Use `_ref` for direct comparison instead.

**Incorrect (resolves reference for every document):**

```groq
// Slow: Must fetch and check author document for EVERY post
*[_type == "post" && author->name == "Bob Woodward"]

// Slow: Nested reference resolution in filter
*[_type == "comment" && post->author->_id == $authorId]
```

**Correct (direct _ref comparison):**

```groq
// Fast: Direct string comparison, uses index
*[_type == "post" && author._ref == "author-bob-woodward-id"]

// If you need to filter by author name, do it in two steps:
// 1. First, get the author ID
// 2. Then filter posts by that ID
```

#### When You Need Dynamic Lookups

If you must filter by a referenced document's field value:

```groq
// Step 1: Get the reference ID first
*[_type == "author" && name == "Bob Woodward"][0]._id

// Step 2: Use that ID in your main query
*[_type == "post" && author._ref == $authorId]
```

Or use a subquery (still better than `->` in filter):

```groq
*[_type == "post" && author._ref in *[_type == "author" && name == "Bob Woodward"]._id]
```

Reference: [High Performance GROQ](https://www.sanity.io/docs/developer-guides/high-performance-groq)

### 1.3 Project Only Needed Fields

Always use projections to return only the fields your application needs. Fetching entire documents wastes bandwidth and processing time.

**Incorrect (fetches everything):**

```groq
// Returns ALL fields including unused ones, metadata, revisions
*[_type == "post"]

// Spread without filtering still includes extra fields
*[_type == "post"]{...}
```

**Correct (explicit projection):**

```groq
// Only fetch what the component needs
*[_type == "post"]{
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  excerpt
}

// For a card component - minimal data
*[_type == "post"]{
  _id,
  title,
  "slug": slug.current,
  "imageUrl": mainImage.asset->url
}[0...10]
```

#### Nested Projections

Apply projections at every level:

```groq
*[_type == "post"]{
  title,
  // Don't just do: author->
  // Project the author fields you need:
  author->{ name, "avatar": image.asset->url },
  // Same for arrays:
  categories[]->{ title, "slug": slug.current }
}
```

#### Dynamic Field Selection

Use conditional projections for different contexts:

```groq
*[_type == "post"]{
  title,
  slug,
  // Only include body for single post view
  $includeBody == true => { body }
}
```

Reference: [GROQ Query Language](https://www.sanity.io/docs/content-lake/how-queries-work)

### 1.4 Merge Repeated Reference Resolutions

Each `->` operator triggers a separate subquery. Repeating the same reference resolution multiple times wastes resources. Merge them into a single resolution.

**Incorrect (multiple subqueries for same reference):**

```groq
// Two separate subqueries to the same parent document
*[_type == "category"]{
  "parentTitle": parent->title,
  "parentSlug": parent->slug.current
}

// Three subqueries to author
*[_type == "post"]{
  "authorName": author->name,
  "authorBio": author->bio,
  "authorImage": author->image
}
```

**Correct (single subquery, merged):**

```groq
// Single subquery, fields merged into result
*[_type == "category"]{
  ...(parent->{ "parentTitle": title, "parentSlug": slug.current })
}

// Single author resolution
*[_type == "post"]{
  author->{ name, bio, image }
}
```

#### The Merge Pattern

Use the spread operator (`...`) with parentheses to merge resolved fields directly into your projection:

```groq
*[_type == "product"]{
  title,
  price,
  // Merge category fields directly into product
  ...(category->{
    "categoryName": name,
    "categorySlug": slug.current
  })
}

// Result: { title, price, categoryName, categorySlug }
```

Reference: [High Performance GROQ](https://www.sanity.io/docs/developer-guides/high-performance-groq)

### 1.5 Order Before Slice

Always apply `order()` before slice notation. Slicing before ordering returns arbitrary results and prevents query optimization.

**Incorrect (slice then order):**

```groq
// Wrong: Slices 10 arbitrary docs, THEN sorts them
*[_type == "post"][0...10] | order(publishedAt desc)

// You get 10 random posts sorted among themselves,
// not the 10 most recent posts
```

**Correct (order then slice):**

```groq
// Correct: Sorts ALL posts by date, THEN takes first 10
*[_type == "post"] | order(publishedAt desc)[0...10]

// You get the 10 most recent posts
```

#### Multiple Sort Fields

Use multiple fields for deterministic ordering (tiebreaker):

```groq
// Primary: featured status, Secondary: date, Tertiary: _id
*[_type == "post"] | order(featured desc, publishedAt desc, _id)[0...10]
```

#### Common Patterns

```groq
// Latest posts
*[_type == "post"] | order(publishedAt desc)[0...10]

// Alphabetical listing
*[_type == "author"] | order(name asc)[0...50]

// Single document (most recent)
*[_type == "post"] | order(publishedAt desc)[0]
```

Reference: [GROQ Query Language](https://www.sanity.io/docs/content-lake/how-queries-work)

### 1.6 Use Cursor-Based Pagination

Deep slice offsets are slow because all skipped documents must be sorted first. Cursor-based pagination fetches only the documents needed.

**Incorrect (offset-based, gets slower with depth):**

```groq
// Page 1: Fast
*[_type == "article"] | order(_id)[0...20]

// Page 500: SLOW - must sort and skip 10,000 docs first
*[_type == "article"] | order(_id)[10000...10020]
```

**Correct (cursor-based, constant time):**

```groq
// Page 1: Start from beginning
*[_type == "article"] | order(_id)[0...20]

// Page 500: Start from last seen ID - only fetches 20 docs
*[_type == "article" && _id > $lastId] | order(_id)[0...20]
```

#### Implementation Pattern

```typescript
// First page
const firstPage = await client.fetch(
  `*[_type == "article"] | order(_id)[0...20]`
)

// Get cursor from last item
const lastId = firstPage[firstPage.length - 1]._id

// Next page using cursor
const nextPage = await client.fetch(
  `*[_type == "article" && _id > $lastId] | order(_id)[0...20]`,
  { lastId }
)
```

#### For Custom Sort Orders

When ordering by a field other than `_id`, include it in the cursor:

```groq
// Order by publishedAt, use as cursor
*[_type == "article" && (
  publishedAt < $lastDate ||
  (publishedAt == $lastDate && _id > $lastId)
)] | order(publishedAt desc, _id)[0...20]
```

Reference: [High Performance GROQ](https://www.sanity.io/docs/developer-guides/high-performance-groq)

### 1.7 Always Use defineQuery

Wrap all GROQ queries in `defineQuery` for TypeGen support. This enables automatic TypeScript type generation from your queries.

**Incorrect (no type generation):**

```typescript
// No TypeGen support, result is `any`
const query = `*[_type == "post"]{ title, slug }`
const posts = await client.fetch(query)
// posts: any
```

**Correct (with defineQuery):**

```typescript
import { defineQuery } from "groq";
// Or for Next.js: import { defineQuery } from "next-sanity";

// TypeGen generates POST_QUERYResult type automatically
const POST_QUERY = defineQuery(`*[_type == "post"]{ title, slug }`)

// With overloadClientMethods (default), types are inferred automatically:
const posts = await client.fetch(POST_QUERY)
// posts is fully typed -- no manual type import needed!

// Or import types explicitly:
import type { POST_QUERYResult } from "@/sanity.types"
```

#### Syntax Highlighting

For VS Code syntax highlighting, use one of these patterns:

```typescript
// Option A: groq tagged template (provides highlighting)
import groq from "groq";
const QUERY = defineQuery(groq`*[_type == "post"]`);

// Option B: Comment prefix (for plain template literals)
const QUERY = defineQuery(/* groq */ `*[_type == "post"]`);
```

#### Query Fragments

Use string interpolation to reuse query logic:

```typescript
const imageFragment = /* groq */ `
  asset->{ _id, url, metadata { lqip, dimensions } },
  alt
`;

const POST_QUERY = defineQuery(/* groq */ `
  *[_type == "post"][0] {
    title,
    mainImage { ${imageFragment} }
  }
`);
```

Reference: [Sanity TypeGen](https://www.sanity.io/docs/apis-and-sdks/sanity-typegen)

---

## 2. Schema Design

Content modeling philosophy, field patterns, references vs objects, validation, and safe deprecation. Foundation for maintainable, scalable content architecture.

### 2.1 Model Data, Not Presentation

Model **what things are**, not **what they look like**. Presentation-focused schemas couple content to specific designs and limit reuse across channels.

**Incorrect (presentation-focused):**

```typescript
// Field names describe appearance, not meaning
defineField({ name: 'bigHeroText', type: 'string' })
defineField({ name: 'redButton', type: 'object', ... })
defineField({ name: 'threeColumnRow', type: 'array', ... })
defineField({ name: 'fontSize', type: 'number' })
defineField({ name: 'color', type: 'string' })
```

**Correct (data-focused):**

```typescript
// Field names describe what the content IS
defineField({ name: 'heroStatement', type: 'string' })
defineField({ name: 'callToAction', type: 'object', ... })
defineField({ name: 'features', type: 'array', ... })
defineField({ name: 'status', type: 'string', options: { list: ['draft', 'published'] } })
defineField({ name: 'role', type: 'string', options: { list: ['admin', 'editor'] } })
```

#### Why This Matters

| Presentation-Focused | Data-Focused | Benefit |
|---------------------|--------------|---------|
| `bigHeroText` | `headline` | Works in any layout |
| `redButton` | `primaryAction` | Design can change |
| `leftSidebar` | `relatedContent` | Position is frontend concern |
| `mobileImage` | `image` (with crops) | Single source, responsive |

#### The Test

Ask: "If we redesigned the site, would this field name still make sense?"

- `threeColumnLayout` -- Fails (what if we go to 2 columns?)
- `features` -- Passes (features are features regardless of layout)

Reference: [Content Modeling](https://www.sanity.io/content-modeling)

### 2.2 Always Use Define Helpers

Always use `defineType`, `defineField`, and `defineArrayMember` from `sanity`. These helpers provide type safety, autocompletion, and ensure proper schema structure.

**Incorrect (plain objects):**

```typescript
// No type checking, no autocompletion, easy to make mistakes
export const article = {
  name: 'article',
  type: 'document',
  fields: [
    { name: 'title', type: 'string' },
    {
      name: 'tags',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'tag' }] }]
    }
  ]
}
```

**Correct (with define helpers):**

```typescript
import { defineType, defineField, defineArrayMember } from 'sanity'
import { TagIcon } from '@sanity/icons'

export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [
        // ALWAYS use defineArrayMember for array items
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'tag' }]
        })
      ]
    })
  ]
})
```

#### Key Rules

| Helper | When to Use |
|--------|-------------|
| `defineType` | Root export of every schema type |
| `defineField` | Every field in a type |
| `defineArrayMember` | Every item in an `of` array |

#### Benefits

1. **Type Safety:** TypeScript catches invalid field configurations
2. **Autocompletion:** IDE suggests valid options
3. **Documentation:** Hover for property descriptions
4. **Validation:** Build-time errors for invalid schemas

Reference: [Schemas and Forms](https://www.sanity.io/docs/studio/schemas-and-forms)

### 2.3 References vs Nested Objects

Choose between `reference` and nested `object` based on content reusability and editing requirements.

#### Use References When:

```typescript
// Author is reusable across many posts
defineField({
  name: 'author',
  type: 'reference',
  to: [{ type: 'author' }]
})

// Categories are shared taxonomy
defineField({
  name: 'categories',
  type: 'array',
  of: [{ type: 'reference', to: [{ type: 'category' }] }]
})
```

**Reference when:**
- Content is reusable across documents
- Content needs its own editing interface
- You need to query/filter by the related content
- Updates should reflect everywhere (single source of truth)

#### Use Nested Objects When:

```typescript
// SEO is document-specific, not shared
defineField({
  name: 'seo',
  type: 'object',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'description', type: 'text' })
  ]
})

// Hero content is page-specific
defineField({
  name: 'hero',
  type: 'object',
  fields: [
    defineField({ name: 'headline', type: 'string' }),
    defineField({ name: 'image', type: 'image' })
  ]
})
```

**Object when:**
- Content is specific to this document
- Content doesn't make sense on its own
- You want simpler editing (all fields in one place)
- You need data to be copied, not linked

#### Quick Decision Matrix

| Scenario | Use |
|----------|-----|
| Blog post author | `reference` (reusable) |
| Product category | `reference` (shared taxonomy) |
| Page SEO fields | `object` (page-specific) |
| Hero section | `object` (page-specific) |
| Team member on About | `reference` (might be used elsewhere) |
| CTA button | `object` (usually page-specific) |

#### Query Differences

```groq
// Reference requires expansion with ->
*[_type == "post"]{ author->{ name, bio } }

// Object is already inline
*[_type == "post"]{ seo { title, description } }
```

Reference: [Schemas and Forms](https://www.sanity.io/docs/studio/schemas-and-forms)

### 2.4 Use _key for Array Items

Every item in a Sanity array automatically gets a `_key` property. Always use `_key` as React's `key` prop -- never use array index.

**Incorrect (index keys):**

```typescript
// Index keys break Visual Editing and cause hydration issues
{items.map((item, index) => (
  <Component key={index} {...item} />
))}
```

**Correct (_key from Sanity):**

```typescript
// Always use Sanity's _key
{items.map((item) => (
  <Component key={item._key} {...item} />
))}

// Works for page builder blocks
{content.map((block) => {
  switch (block._type) {
    case 'hero':
      return <Hero key={block._key} {...block} />
    case 'features':
      return <Features key={block._key} {...block} />
    default:
      return null
  }
})}
```

#### Why This Matters

| Key Type | React Reconciliation | Visual Editing | Reordering |
|----------|---------------------|----------------|------------|
| `_key` | Stable | Works | Smooth |
| `index` | Breaks on reorder | Broken overlays | Flickers |

#### Schema Note

You don't define `_key` in your schema -- Sanity auto-generates it for array items. Just ensure you query it and use it in your frontend.

```groq
*[_type == "page"][0]{
  pageBuilder[]{
    _key,  // Always include _key in queries
    _type,
    ...
  }
}
```

Reference: [Visual Editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing)

### 2.5 Use Validation Effectively

Sanity offers powerful validation beyond `rule.required()`. Use validation to ensure content quality and prevent invalid data.

#### Common Patterns

```typescript
// Email validation
defineField({
  name: 'email',
  type: 'string',
  validation: (rule) => rule.email().required()
})

// URL validation with custom message
defineField({
  name: 'website',
  type: 'url',
  validation: (rule) => rule.uri({
    scheme: ['http', 'https']
  }).error('Must be a valid URL starting with http:// or https://')
})

// Length constraints with warning (not error)
defineField({
  name: 'excerpt',
  type: 'text',
  validation: (rule) => rule.max(200).warning('Keep under 200 chars for best SEO')
})

// Regex pattern for slugs
defineField({
  name: 'slug',
  type: 'slug',
  validation: (rule) => rule.required().custom((slug) => {
    if (!slug?.current) return 'Required'
    if (!/^[a-z0-9-]+$/.test(slug.current)) {
      return 'Slug must be lowercase with hyphens only'
    }
    return true
  })
})
```

#### Cross-Field Validation

```typescript
defineField({
  name: 'endDate',
  type: 'datetime',
  validation: (rule) => rule.custom((endDate, context) => {
    const startDate = context.document?.startDate
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return 'End date must be after start date'
    }
    return true
  })
})
```

#### Array Validation

```typescript
defineField({
  name: 'tags',
  type: 'array',
  of: [{ type: 'string' }],
  validation: (rule) => rule
    .min(1).error('Add at least one tag')
    .max(10).warning('Too many tags may hurt SEO')
    .unique()
})
```

#### Async Validation (Uniqueness)

```typescript
defineField({
  name: 'slug',
  type: 'slug',
  validation: (rule) => rule.required().custom(async (slug, context) => {
    if (!slug?.current) return true

    const client = context.getClient({ apiVersion: '2024-01-01' })
    const id = context.document?._id?.replace(/^drafts\./, '')

    const existing = await client.fetch(
      `count(*[_type == "post" && slug.current == $slug && _id != $id])`,
      { slug: slug.current, id }
    )

    return existing === 0 || 'Slug already exists'
  })
})
```

Reference: [Validation](https://www.sanity.io/docs/studio/validation)

### 2.6 Safe Field Deprecation Pattern

**NEVER** delete a field that contains production data. It causes data loss or Studio crashes. Instead, follow the ReadOnly -> Hidden -> Deprecated lifecycle.

**Incorrect (dangerous):**

```typescript
// NEVER do this - deleting a field with existing data
// Data is lost, Studio may crash trying to render it
defineType({
  name: 'article',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    // Deleted: defineField({ name: 'oldTitle', type: 'string' }),
  ]
})
```

**Correct (safe deprecation):**

```typescript
defineField({
  name: 'oldTitle',
  title: 'Article Title (Deprecated)',
  type: 'string',
  // 1. Show deprecation warning with reason
  deprecated: {
    reason: 'Use the new "seoTitle" field instead. Will be removed in v2.'
  },
  // 2. Prevent new edits
  readOnly: true,
  // 3. Hide from NEW documents (where value is undefined)
  hidden: ({ value }) => value === undefined,
  // 4. Ensure new documents don't get this field
  initialValue: undefined
})
```

#### Migration Workflow

**Phase 1: Deprecate**
1. Apply the deprecation pattern above
2. Deploy schema changes

**Phase 2: Migrate**
1. Update frontend to use new fields (with fallbacks using `coalesce()`)
2. Create a migration file in `migrations/` folder:

```typescript
// migrations/rename-oldTitle-to-newTitle/index.ts
import {defineMigration, at, setIfMissing, unset} from 'sanity/migrate'

export default defineMigration({
  title: 'Rename oldTitle to newTitle',
  documentTypes: ['article'],
  filter: 'defined(oldTitle) && !defined(newTitle)',
  migrate: {
    document(doc) {
      if (!doc.oldTitle || doc.newTitle) return // Skip if already migrated
      return [
        at('newTitle', setIfMissing(doc.oldTitle)),
        at('oldTitle', unset())
      ]
    }
  }
})
```

3. Run the migration:

```bash
# Dry run first (default)
sanity migration run rename-oldTitle-to-newTitle

# Execute when ready
sanity migration run rename-oldTitle-to-newTitle --no-dry-run
```

**Phase 3: Remove**
1. Verify `oldTitle` is undefined for all documents
2. Delete the field definition from schema

Reference: [Schema and Content Migrations](https://www.sanity.io/docs/content-lake/schema-and-content-migrations)

---

## 3. Visual Editing

Presentation Tool setup, Content Source Maps (Stega), overlays, and live preview configuration. Critical for editor experience and real-time content editing.

### 3.1 Configure Presentation Tool Correctly

The Presentation Tool renders your frontend inside Studio, enabling click-to-edit overlays and navigation between documents and their preview locations.

#### Basic Setup

```typescript
// sanity.config.ts
import { defineConfig } from 'sanity'
import { presentationTool } from 'sanity/presentation'
import { resolve } from '@/sanity/presentation/resolve'

export default defineConfig({
  // ...
  plugins: [
    presentationTool({
      resolve,
      previewUrl: {
        previewMode: {
          enable: '/api/draft-mode/enable',
        },
      },
    }),
  ],
})
```

#### Document Locations Resolver

Define where documents appear in the frontend for quick navigation:

```typescript
// src/sanity/presentation/resolve.ts
import { defineLocations, PresentationPluginOptions } from 'sanity/presentation'

export const resolve: PresentationPluginOptions['resolve'] = {
  locations: {
    post: defineLocations({
      select: { title: 'title', slug: 'slug.current' },
      resolve: (doc) => ({
        locations: [
          { title: doc?.title || 'Untitled', href: `/posts/${doc?.slug}` },
          { title: 'Posts index', href: `/posts` },
        ],
      }),
    }),
    page: defineLocations({
      select: { title: 'title', slug: 'slug.current' },
      resolve: (doc) => ({
        locations: [
          { title: doc?.title || 'Untitled', href: `/${doc?.slug}` },
        ],
      }),
    }),
  },
}
```

#### Visual Editing Component (Next.js)

Render overlays in Draft Mode:

```typescript
// app/layout.tsx
import { VisualEditing } from 'next-sanity/visual-editing'
import { draftMode } from 'next/headers'

export default async function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {(await draftMode()).isEnabled && <VisualEditing />}
      </body>
    </html>
  )
}
```

#### Token Security

Store tokens securely, never expose in client bundles:

```typescript
// src/sanity/lib/token.ts
export const token = process.env.SANITY_API_READ_TOKEN

if (!token) {
  throw new Error('Missing SANITY_API_READ_TOKEN')
}
```

Reference: [Presentation Tool](https://www.sanity.io/docs/visual-editing/configuring-the-presentation-tool)

### 3.2 Never Allow Stega in Metadata

**NEVER** allow Stega strings in `<head>` tags (title, description, canonical URLs). Invisible characters destroy SEO rankings and look broken in search results.

**Incorrect (stega in metadata):**

```typescript
// Stega characters in title tag will show garbled text in search results
export async function generateMetadata({ params }) {
  const { data } = await sanityFetch({
    query: PAGE_QUERY,
    // Missing stega: false!
  })
  return {
    title: data.title, // Contains hidden characters
    description: data.description
  }
}
```

**Correct (disable stega for metadata):**

```typescript
// Next.js Example
export async function generateMetadata({ params }) {
  const { data } = await sanityFetch({
    query: SEO_QUERY,
    stega: false  // CRITICAL - disable stega for metadata
  })

  return {
    title: data.title,
    description: data.description
  }
}
```

#### Alternative: Clean Explicitly

If you can't disable stega at the fetch level:

```typescript
import { stegaClean } from "@sanity/client/stega";

export async function generateMetadata({ params }) {
  const { data } = await sanityFetch({ query: PAGE_QUERY })

  return {
    title: stegaClean(data.title),
    description: stegaClean(data.description),
    openGraph: {
      url: stegaClean(data.canonicalUrl)
    }
  }
}
```

#### What Happens Without This

| Field | With Stega | Search Result Display |
|-------|------------|----------------------|
| Title | `My Page...` | `My Page` (invisible chars) |
| Description | `About us...` | Truncated/garbled text |
| Canonical URL | `example.com/page...` | 404 or wrong page |

Reference: [Visual Editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing)

### 3.3 Clean Stega for Logic Operations

When Visual Editing is enabled, string fields contain invisible Stega characters for click-to-edit functionality. You **MUST** clean them before using values for logic.

**Incorrect (stega breaks logic):**

```typescript
// Stega characters cause comparison to fail
function Layout({ align }: { align: string }) {
  // This will NEVER be true because align contains hidden characters
  if (align === 'center') {
    return <div className="mx-auto">...</div>
  }
}

// Object key lookup fails
const colors = { red: 'bg-red-500', blue: 'bg-blue-500' }
const className = colors[color] // undefined - key doesn't match
```

**Correct (clean before logic):**

```typescript
import { stegaClean } from "@sanity/client/stega";

function Layout({ align }: { align: string }) {
  // Clean before comparison
  const cleanAlign = stegaClean(align);
  return (
    <div className={cleanAlign === 'center' ? 'mx-auto' : ''}>
      ...
    </div>
  )
}

// Clean before object key lookup
const colors = { red: 'bg-red-500', blue: 'bg-blue-500' }
const className = colors[stegaClean(color)]
```

#### When to Clean

| Scenario | Clean? | Why |
|----------|--------|-----|
| Comparing strings (`if (x === 'y')`) | Yes | Stega breaks equality |
| Using as object keys | Yes | Keys won't match |
| Using as HTML IDs | Yes | Invalid characters |
| Passing to third-party libraries | Yes | May validate input |
| Rendering text (`<h1>{title}</h1>`) | No | Breaks click-to-edit |
| Passing to `<PortableText />` | No | Handles internally |
| Passing to image helpers | No | Handles internally |

#### Next.js Specific

Import from `next-sanity` for convenience:

```typescript
import { stegaClean } from "next-sanity";
```

Reference: [Visual Editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing)

---

## 4. Images

Image schema with hotspots, URL builder patterns, LQIP (blur placeholders), and Next.js Image integration.

### 4.1 Always Enable Image Hotspots

Always enable `hotspot: true` on image fields. This allows editors to control cropping and set the focal point, ensuring the important part of images is always visible.

**Incorrect (no hotspot):**

```typescript
// Editors can't control cropping - faces may get cut off
defineField({
  name: 'mainImage',
  type: 'image'
})
```

**Correct (with hotspot):**

```typescript
defineField({
  name: 'mainImage',
  title: 'Main Image',
  type: 'image',
  options: {
    hotspot: true  // CRITICAL
  }
})
```

#### Why This Matters

| Aspect Ratio | Without Hotspot | With Hotspot |
|--------------|-----------------|--------------|
| Square crop | May cut off subject | Focuses on hotspot |
| Wide banner | Random center crop | Editor-defined focus |
| Mobile portrait | Unpredictable | Always shows key area |

#### Using Hotspot in URL Builder

```typescript
import { urlFor } from '@/sanity/lib/image'

// The URL builder automatically uses hotspot/crop data
const imageUrl = urlFor(mainImage)
  .width(800)
  .height(600)
  .fit('crop')  // Respects hotspot when cropping
  .url()
```

#### Query the Hotspot Data

Include hotspot and crop data when needed for advanced layouts:

```groq
mainImage {
  asset->{ _id, url },
  alt,
  hotspot,  // { x, y, width, height }
  crop      // { top, bottom, left, right }
}
```

Reference: [Image URLs](https://www.sanity.io/docs/apis-and-sdks/image-urls)

### 4.2 Query LQIP for Blur Placeholders

LQIP (Low Quality Image Placeholder) is **not automatic**. You must explicitly query `asset->metadata.lqip` to enable blur-up loading effects.

**Incorrect (LQIP unavailable):**

```groq
// No LQIP data - blur placeholder won't work
mainImage {
  asset->{ _id, url },
  alt
}
```

**Correct (with LQIP):**

```groq
// Full query with LQIP and dimensions
mainImage {
  asset->{
    _id,
    url,
    metadata {
      lqip,                          // Base64 blur placeholder
      dimensions { width, height }   // For aspect ratio
    }
  },
  alt,
  hotspot,
  crop
}
```

#### Using LQIP in Next.js

```typescript
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'

interface SanityImageProps {
  value: {
    asset: {
      _id: string
      url: string
      metadata?: {
        lqip?: string
        dimensions?: { width: number; height: number }
      }
    }
    alt?: string
  }
  width?: number
}

export function SanityImage({ value, width = 800 }: SanityImageProps) {
  if (!value?.asset) return null

  const aspectRatio = value.asset.metadata?.dimensions
    ? value.asset.metadata.dimensions.width / value.asset.metadata.dimensions.height
    : 1.5

  return (
    <Image
      src={urlFor(value).width(width).url()}
      alt={value.alt || ''}
      width={width}
      height={Math.round(width / aspectRatio)}
      // Blur placeholder from LQIP
      placeholder={value.asset.metadata?.lqip ? 'blur' : 'empty'}
      blurDataURL={value.asset.metadata?.lqip}
    />
  )
}
```

#### Without LQIP

If you don't query LQIP, `blurDataURL` will be `undefined` and the placeholder won't work. The image will flash in without the smooth blur-up effect.

Reference: [Image URLs](https://www.sanity.io/docs/apis-and-sdks/image-urls)

---

## 5. Portable Text

Rich text rendering, custom block types, mark components, and presentation queries for live editing.

### 5.1 Define Typed Portable Text Components

Always define a typed `components` object for Portable Text rendering. This handles custom blocks, marks, and styling consistently.

**Incorrect (no custom components):**

```typescript
// Uses default rendering, custom blocks won't work
import { PortableText } from "next-sanity";

export function Content({ value }) {
  return <PortableText value={value} />
}
```

**Correct (with typed components):**

```typescript
import { PortableText, PortableTextBlock, PortableTextComponents } from "next-sanity";

const components: PortableTextComponents = {
  // 1. Block styles (paragraphs, headings)
  block: {
    h1: ({ children }) => <h1 className="text-4xl font-bold mt-8 mb-4">{children}</h1>,
    h2: ({ children }) => <h2 className="text-3xl font-bold mt-6 mb-3">{children}</h2>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 italic">{children}</blockquote>
    ),
  },

  // 2. Custom types (non-text blocks)
  types: {
    image: ({ value }) => <SanityImage value={value} />,
    callToAction: ({ value }) => (
      <Button href={value.url}>{value.text}</Button>
    ),
  },

  // 3. Marks (inline annotations)
  marks: {
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    link: ({ children, value }) => {
      // Tip: Use your framework's Link component for internal links (e.g., next/link)
      const rel = !value.href?.startsWith("/") ? "noreferrer noopener" : undefined;
      return (
        <a href={value.href} rel={rel} className="underline text-blue-600">
          {children}
        </a>
      );
    },
  },

  // 4. Lists
  list: {
    bullet: ({ children }) => <ul className="list-disc ml-6">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal ml-6">{children}</ol>,
  },
};

// Use generated types from sanity.types.ts for full type safety
export function Content({ value }: { value: PortableTextBlock[] }) {
  return <PortableText value={value} components={components} />;
}
```

#### Component Categories

| Type | Examples | Access Pattern |
|------|----------|----------------|
| `block` | h1, h2, blockquote, normal | `{ children }` |
| `types` | image, video, callToAction | `{ value }` |
| `marks` | link, strong, highlight | `{ children, value }` |
| `list` | bullet, number | `{ children }` |

#### Tip: Tailwind Typography

For simple blogs, wrap in a `prose` container instead of styling every block:

```typescript
<div className="prose prose-lg">
  <PortableText value={value} components={components} />
</div>
```

Reference: [Portable Text Editor](https://www.sanity.io/docs/studio/customizing-the-portable-text-editor)

---

## 6. Page Builder

Flexible page composition with block arrays, component rendering patterns, and TypeScript typing.

### 6.1 Objects vs References in Page Builders

Most page builder blocks should be **objects**, not references. Use references sparingly for content that's truly shared across many pages.

**Incorrect (overusing references):**

```typescript
// Every block is a reference - overcomplicated
defineType({
  name: 'pageBuilder',
  type: 'array',
  of: [
    { type: 'reference', to: [{ type: 'heroBlock' }] },
    { type: 'reference', to: [{ type: 'featuresBlock' }] },
    { type: 'reference', to: [{ type: 'ctaBlock' }] },
  ]
})
```

**Correct (objects by default):**

```typescript
// Blocks are objects - simple, page-specific
defineType({
  name: 'pageBuilder',
  type: 'array',
  of: [
    defineArrayMember({ type: 'hero' }),
    defineArrayMember({ type: 'features' }),
    defineArrayMember({ type: 'cta' }),
    // Reference only for truly shared content
    defineArrayMember({
      type: 'reference',
      to: [{ type: 'testimonial' }],
      title: 'Shared Testimonial'
    }),
  ]
})
```

#### Decision Matrix

| Use Objects | Use References |
|-------------|----------------|
| Content unique to this page | Content reused across many pages |
| Simpler queries | Needs central management |
| Default choice | FAQs, testimonials, reusable CTAs |

#### Query Differences

```groq
// Objects - already inline
*[_type == "page"][0]{
  pageBuilder[]{ ... }
}

// References - need expansion
*[_type == "page"][0]{
  pageBuilder[]{
    ...,
    _type == "reference" => @->{ ... }
  }
}
```

Reference: [Page Building Guide](https://www.sanity.io/docs/developer-guides/how-to-use-structured-content-for-page-building)

### 6.2 Configure Block Previews

Every page builder block should have consistent previews with title, subtitle (block type name), and icon. This makes the Studio experience clear and navigable.

**Incorrect (no preview):**

```typescript
// No preview - shows generic "Object" in Studio
defineType({
  name: 'hero',
  type: 'object',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'image', type: 'image' }),
  ]
})
```

**Correct (with preview):**

```typescript
import { BlockContentIcon } from '@sanity/icons'

defineType({
  name: 'hero',
  type: 'object',
  icon: BlockContentIcon,
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'image', type: 'image' }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'image'
    },
    prepare({ title, media }) {
      return {
        title: title || 'Untitled',
        subtitle: 'Hero',  // Block type name
        media: media ?? BlockContentIcon,  // Fallback to icon
      }
    },
  },
})
```

#### Preview Best Practices

| Field | Purpose | Example |
|-------|---------|---------|
| `title` | Primary content identifier | Headline, name |
| `subtitle` | Block type name | "Hero", "Features", "FAQ" |
| `media` | Visual identifier | Image or icon fallback |

#### Visual Insert Menu

For a polished insert menu with thumbnails:

```typescript
defineType({
  name: 'pageBuilder',
  type: 'array',
  of: [/* blocks */],
  options: {
    insertMenu: {
      views: [
        {
          name: 'grid',
          previewImageUrl: (type) => `/block-previews/${type}.png`
        },
      ],
    },
  },
})
```

Reference: [Schema Previews](https://www.sanity.io/docs/studio/previews-list-views)

---

## 7. Studio Configuration

Desk structure customization, singleton patterns, document views, and navigation organization.

### 7.1 Always Assign Icons

Always assign an icon from `@sanity/icons` to documents and objects. Icons significantly improve Studio navigation and visual hierarchy.

**Incorrect (no icons):**

```typescript
// Generic icons make navigation harder
defineType({
  name: 'article',
  type: 'document',
  fields: [/* ... */]
})

defineType({
  name: 'hero',
  type: 'object',
  fields: [/* ... */]
})
```

**Correct (with icons):**

```typescript
import { DocumentTextIcon, BlockContentIcon } from '@sanity/icons'

defineType({
  name: 'article',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [/* ... */]
})

defineType({
  name: 'hero',
  type: 'object',
  icon: BlockContentIcon,
  fields: [/* ... */]
})
```

#### Common Icon Mappings

| Content Type | Icon |
|--------------|------|
| Article, Post | `DocumentTextIcon` |
| Author, Person | `UserIcon` |
| Category, Tag | `TagIcon` |
| Settings | `CogIcon` |
| Page | `DocumentIcon` |
| Image block | `ImageIcon` |
| Video block | `PlayIcon` |
| FAQ | `HelpCircleIcon` |
| Link | `LinkIcon` |

#### Browse All Icons

```bash
# Install and explore
npm install @sanity/icons
```

Browse all icons at [icons.sanity.build](https://icons.sanity.build/all)

Reference: [Schemas and Forms](https://www.sanity.io/docs/studio/schemas-and-forms)

### 7.2 Implement Singletons via Structure

Singletons (site settings, homepage) are enforced via **Structure**, not schema. There is no `singleton: true` schema option.

**Incorrect (no such option):**

```typescript
// This doesn't exist
defineType({
  name: 'settings',
  type: 'document',
  singleton: true,  // Not a thing!
})
```

**Correct (via Structure):**

```typescript
// 1. Normal schema definition
defineType({
  name: 'settings',
  title: 'Site Settings',
  type: 'document',
  icon: CogIcon,
  fields: [/* ... */]
})

// 2. Structure with fixed documentId
// src/structure/index.ts
const SINGLETONS = ['settings', 'homePage']

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // Singleton with fixed ID
      S.listItem()
        .title('Site Settings')
        .icon(CogIcon)
        .child(
          S.document()
            .schemaType('settings')
            .documentId('settings')  // Fixed ID = singleton
        ),

      S.divider(),

      // Filter singletons from generic lists
      ...S.documentTypeListItems().filter(
        (item) => !SINGLETONS.includes(item.getId() as string)
      )
    ])
```

#### Helper Function

```typescript
function createSingleton(
  S: StructureBuilder,
  typeName: string,
  title: string,
  icon?: ComponentType
) {
  return S.listItem()
    .title(title)
    .icon(icon)
    .child(
      S.document()
        .schemaType(typeName)
        .documentId(typeName)
        .title(title)
    )
}

// Usage
createSingleton(S, 'settings', 'Site Settings', CogIcon)
```

#### Querying Singletons

```groq
// By fixed ID (most efficient)
*[_id == "settings"][0]

// By type (works but slower)
*[_type == "settings"][0]
```

Reference: [Studio Structure](https://www.sanity.io/docs/studio/structure-builder-introduction)

---

## 8. TypeGen

TypeScript type generation from schema and queries, configuration patterns, and workflow integration.

### 8.1 TypeGen Update Workflow

TypeGen generates types from your schema and GROQ queries. Enable automatic generation or run manually.

> For full configuration details, project structure examples, type utilities, and advanced patterns, see the TypeGen comprehensive guide.

#### Automatic Generation (Recommended)

Enable in `sanity.cli.ts` -- types regenerate during `sanity dev` and `sanity build`:

```typescript
// sanity.cli.ts
import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  typegen: {
    enabled: true,
  },
})
```

For separate frontend repos, use watch mode: `npx sanity typegen generate --watch`

#### Manual Generation

```json
{
  "scripts": {
    "typegen": "sanity schema extract && sanity typegen generate"
  }
}
```

#### Configuration

> **Note:** `sanity-typegen.json` is deprecated. Configure TypeGen in `sanity.cli.ts` instead.

```typescript
// sanity.cli.ts
import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  typegen: {
    enabled: true,
    path: "./src/**/*.{ts,tsx,js,jsx,astro,svelte,vue}",
    schema: "schema.json",
    generates: "./sanity.types.ts",
    overloadClientMethods: true, // Auto-type client.fetch() calls
  },
})
```

#### Usage

With `overloadClientMethods: true` (default), `client.fetch()` returns typed results automatically:

```typescript
import { defineQuery } from "groq";

const POST_QUERY = defineQuery(`*[_type == "post"]{ title, slug }`)

// Return type is inferred automatically -- no manual type import needed!
const posts = await client.fetch(POST_QUERY)
```

Or import generated types directly:

```typescript
import type { POST_QUERYResult } from "./sanity.types"

function PostList({ posts }: { posts: POST_QUERYResult }) {
  // Fully typed!
}
```

Reference: [Sanity TypeGen](https://www.sanity.io/docs/apis-and-sdks/sanity-typegen)

---

## 9. Localization

Document-level and field-level internationalization, locale management, and querying patterns.

### 9.1 Choose Document vs Field-Level Localization

Choose your localization method based on content type. Wrong choice leads to awkward editing or complex queries.

#### Document-Level Localization

One document per language. Use for **presentation content** (pages, posts).

```typescript
// Plugin: @sanity/document-internationalization
import { documentInternationalization } from '@sanity/document-internationalization'

export default defineConfig({
  plugins: [
    documentInternationalization({
      supportedLanguages: [
        { id: 'en', title: 'English' },
        { id: 'fr', title: 'French' },
      ],
      schemaTypes: ['post', 'page'],
    }),
  ],
})
```

**Query:**
```groq
*[_type == "post" && language == $locale && slug.current == $slug][0]
```

**When to use:**
- Content is mostly different per language
- Need independent publishing per locale
- Pages, posts, marketing content

#### Field-Level Localization

One document, localized fields. Use for **structured data** (products, people).

```typescript
// Plugin: sanity-plugin-internationalized-array
import { internationalizedArray } from 'sanity-plugin-internationalized-array'

export default defineConfig({
  plugins: [
    internationalizedArray({
      languages: [
        { id: 'en', title: 'English' },
        { id: 'fr', title: 'French' },
      ],
      fieldTypes: ['string', 'text'],
    }),
  ],
})

// Schema
defineField({
  name: 'jobTitle',
  type: 'internationalizedArrayString',
})
```

**Query:**
```groq
*[_type == "author"][0]{
  "jobTitle": jobTitle[_key == $locale][0].value
}
```

**When to use:**
- Most fields shared across languages
- Changes should be "global" (reordering, structure)
- Products, people, categories

#### Decision Matrix

| Question | Yes | No |
|----------|-----|-----|
| Publish languages independently? | Document | Field |
| Content mostly different per locale? | Document | Field |
| Need global structure changes? | Field | Document |

Reference: [Localization Guide](https://www.sanity.io/docs/studio/localization)

---

## 10. Migration

Content import from HTML/Markdown, image handling, and schema validation during migrations.

### 10.1 Import HTML to Portable Text

Use `@portabletext/block-tools` with `JSDOM` to convert HTML from legacy CMSs to Portable Text.

#### Setup

```bash
npm install @portabletext/block-tools jsdom
```

#### Basic Conversion

```typescript
import { htmlToBlocks } from '@portabletext/block-tools'
import { JSDOM } from 'jsdom'

// Get block content type from your schema
const blockContentType = schema.get('blockContent')

const blocks = htmlToBlocks(htmlString, blockContentType, {
  parseHtml: html => new JSDOM(html).window.document,
})
```

#### Custom Deserializers

Handle specific HTML patterns:

```javascript
const blocks = htmlToBlocks(htmlString, blockContentType, {
  parseHtml: html => new JSDOM(html).window.document,
  rules: [
    {
      deserialize(el, next, block) {
        // Custom link handling
        if (el.tagName.toLowerCase() === 'a') {
          return {
            _type: 'link',
            href: el.getAttribute('href'),
            blank: el.getAttribute('target') === '_blank'
          }
        }
        // Custom image handling
        if (el.tagName.toLowerCase() === 'img') {
          return {
            _type: 'image',
            // Upload image separately, store reference
            _sanityAsset: `image@${el.getAttribute('src')}`
          }
        }
        return undefined  // Fall through to default handling
      }
    }
  ]
})
```

#### Pre-Processing HTML

Clean HTML before conversion:

```javascript
function cleanHtml(html) {
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // Remove layout elements
  doc.querySelectorAll('header, footer, nav, .sidebar').forEach(el => el.remove())

  // Extract metadata before processing body
  const title = doc.querySelector('title')?.textContent
  const description = doc.querySelector('meta[name="description"]')?.content

  return {
    body: doc.body.innerHTML,
    metadata: { title, description }
  }
}
```

#### Image Upload

Don't just link external images -- upload them:

```javascript
async function uploadImage(client, imageUrl) {
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()

  const asset = await client.assets.upload('image', Buffer.from(buffer), {
    filename: imageUrl.split('/').pop()
  })

  return {
    _type: 'image',
    asset: { _type: 'reference', _ref: asset._id }
  }
}
```

#### Using in a Migration

Wrap this in `defineMigration` for reproducible imports:

```typescript
// migrations/import-wordpress-posts/index.ts
import {defineMigration, createOrReplace} from 'sanity/migrate'
import {htmlToBlocks} from '@portabletext/block-tools'

export default defineMigration({
  title: 'Import WordPress posts',
  async *migrate(documents, context) {
    const posts = await fetchWordPressPosts() // Your import source

    for (const post of posts) {
      const blocks = htmlToBlocks(post.content, blockContentType, {
        parseHtml: html => new JSDOM(html).window.document,
      })

      yield createOrReplace({
        _id: `post-${post.slug}`,
        _type: 'post',
        title: post.title,
        body: blocks,
      })
    }
  }
})
```

Run with: `sanity migration run import-wordpress-posts --no-dry-run`

Reference: [Schema and Content Migrations](https://www.sanity.io/docs/content-lake/schema-and-content-migrations)
