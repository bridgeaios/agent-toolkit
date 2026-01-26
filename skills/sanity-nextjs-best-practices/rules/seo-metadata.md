---
title: SEO Metadata with generateMetadata
description: Generate type-safe metadata from Sanity with stega disabled
tags: nextjs, seo, metadata, generateMetadata, open-graph
---

## SEO Metadata with generateMetadata

Next.js App Router's `generateMetadata` function generates page metadata from Sanity content. **Critical:** Always disable stega for metadata queries.

### Basic Pattern

```typescript
// src/app/blog/[slug]/page.tsx
import { Metadata } from 'next'
import { sanityFetch } from '@/sanity/lib/live'
import { urlFor } from '@/sanity/lib/image'

const SEO_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    title,
    excerpt,
    "slug": slug.current,
    mainImage,
    seo {
      metaTitle,
      metaDescription,
      ogImage
    }
  }
`)

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}): Promise<Metadata> {
  const { slug } = await params
  
  const { data } = await sanityFetch({
    query: SEO_QUERY,
    params: { slug },
    stega: false, // CRITICAL: No stega in metadata
  })

  if (!data) {
    return { title: 'Not Found' }
  }

  const title = data.seo?.metaTitle || data.title
  const description = data.seo?.metaDescription || data.excerpt
  const image = data.seo?.ogImage || data.mainImage

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/blog/${slug}`,
      images: image ? [{
        url: urlFor(image).width(1200).height(630).url(),
        width: 1200,
        height: 630,
        alt: title,
      }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [urlFor(image).width(1200).height(630).url()] : [],
    },
  }
}
```

### Why stega: false is Critical

Stega characters in metadata will:
- Appear in browser tabs as garbled text
- Show in Google search results
- Break social media previews
- Corrupt structured data

```typescript
// BAD: Stega enabled (default)
const { data } = await sanityFetch({ query: SEO_QUERY })
// title = "My Post Title" + invisible characters

// GOOD: Stega disabled
const { data } = await sanityFetch({ query: SEO_QUERY, stega: false })
// title = "My Post Title"
```

### SEO Schema Pattern

Define a reusable SEO object in your schema:

```typescript
// schemaTypes/objects/seo.ts
import { defineType, defineField } from 'sanity'

export const seoType = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'metaTitle',
      title: 'Meta Title',
      type: 'string',
      description: 'Override the default title (50-60 characters recommended)',
      validation: (rule) => rule.max(60).warning('Title should be under 60 characters'),
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description',
      type: 'text',
      rows: 3,
      description: 'Override the default description (150-160 characters recommended)',
      validation: (rule) => rule.max(160).warning('Description should be under 160 characters'),
    }),
    defineField({
      name: 'ogImage',
      title: 'Social Share Image',
      type: 'image',
      description: 'Image for social media sharing (1200x630 recommended)',
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from Search Engines',
      type: 'boolean',
      description: 'Prevent this page from appearing in search results',
      initialValue: false,
    }),
  ],
})
```

### Handling noIndex

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const { data } = await sanityFetch({
    query: SEO_QUERY,
    params,
    stega: false,
  })

  return {
    title: data.seo?.metaTitle || data.title,
    description: data.seo?.metaDescription,
    robots: data.seo?.noIndex 
      ? { index: false, follow: false }
      : { index: true, follow: true },
  }
}
```

### Canonical URLs

Prevent duplicate content issues:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params
  
  return {
    // ... other metadata
    alternates: {
      canonical: `https://example.com/blog/${slug}`,
    },
  }
}
```

### Default Metadata in Layout

Set site-wide defaults in your root layout:

```typescript
// src/app/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: 'My Site',
    template: '%s | My Site', // "Page Title | My Site"
  },
  description: 'Default site description',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'My Site',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mysite',
  },
}
```

### Fetching Site Settings

For global SEO settings from Sanity:

```typescript
// src/app/layout.tsx
import { sanityFetch } from '@/sanity/lib/live'

const SETTINGS_QUERY = defineQuery(`
  *[_type == "settings"][0]{
    siteName,
    siteDescription,
    defaultOgImage,
    twitterHandle
  }
`)

export async function generateMetadata(): Promise<Metadata> {
  const { data: settings } = await sanityFetch({
    query: SETTINGS_QUERY,
    stega: false,
  })

  return {
    metadataBase: new URL('https://example.com'),
    title: {
      default: settings?.siteName || 'My Site',
      template: `%s | ${settings?.siteName || 'My Site'}`,
    },
    description: settings?.siteDescription,
    openGraph: {
      images: settings?.defaultOgImage 
        ? [urlFor(settings.defaultOgImage).width(1200).height(630).url()]
        : [],
    },
    twitter: {
      site: settings?.twitterHandle,
    },
  }
}
```

### Structured Data (JSON-LD)

Add structured data for rich search results:

```typescript
// src/app/blog/[slug]/page.tsx
import { sanityFetch } from '@/sanity/lib/live'

export default async function BlogPost({ params }) {
  const { data } = await sanityFetch({
    query: POST_QUERY,
    params: await params,
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.excerpt,
    image: data.mainImage ? urlFor(data.mainImage).width(1200).url() : undefined,
    datePublished: data.publishedAt,
    author: {
      '@type': 'Person',
      name: data.author?.name,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>{/* ... */}</article>
    </>
  )
}
```

### Pages Router Pattern

For Pages Router, use `next/head`:

```typescript
// pages/blog/[slug].tsx
import Head from 'next/head'
import { urlFor } from '@/sanity/lib/image'

export default function BlogPost({ post }) {
  const title = post.seo?.metaTitle || post.title
  const description = post.seo?.metaDescription || post.excerpt
  const image = post.seo?.ogImage || post.mainImage

  return (
    <>
      <Head>
        <title>{title} | My Site</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {image && (
          <meta 
            property="og:image" 
            content={urlFor(image).width(1200).height(630).url()} 
          />
        )}
        <link rel="canonical" href={`https://example.com/blog/${post.slug}`} />
      </Head>
      <article>{/* ... */}</article>
    </>
  )
}
```

Reference: [Next.js Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
