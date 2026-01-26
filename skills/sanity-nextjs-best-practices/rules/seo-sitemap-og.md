---
title: Sitemaps and OG Images
description: Generate dynamic sitemaps and Open Graph images from Sanity content
tags: nextjs, seo, sitemap, og-image, robots
---

## Sitemaps and OG Images

Dynamic sitemaps and Open Graph images improve SEO and social sharing. Generate both from Sanity content.

### Dynamic Sitemap

**`src/app/sitemap.ts`:**

```typescript
import { MetadataRoute } from 'next'
import { client } from '@/sanity/lib/client'

const SITEMAP_QUERY = /* groq */ `
  *[_type in ["page", "post"] && defined(slug.current) && seo.noIndex != true]{
    _type,
    "slug": slug.current,
    _updatedAt
  }
`

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com'
  
  // Fetch all public pages from Sanity
  const documents = await client.fetch(SITEMAP_QUERY, {}, { 
    cache: 'no-store' // Always fresh for sitemap
  })

  const pages = documents.map((doc: any) => {
    let url: string
    
    switch (doc._type) {
      case 'page':
        url = doc.slug === 'home' ? baseUrl : `${baseUrl}/${doc.slug}`
        break
      case 'post':
        url = `${baseUrl}/blog/${doc.slug}`
        break
      default:
        url = `${baseUrl}/${doc.slug}`
    }

    return {
      url,
      lastModified: new Date(doc._updatedAt),
      changeFrequency: 'weekly' as const,
      priority: doc._type === 'page' ? 0.8 : 0.6,
    }
  })

  // Add static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), priority: 1 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), priority: 0.5 },
  ]

  return [...staticPages, ...pages]
}
```

### Multiple Sitemaps (Large Sites)

For sites with many pages, split into multiple sitemaps:

```typescript
// src/app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
    },
  ]
}

export async function generateSitemaps() {
  // Return array of sitemap IDs
  const totalPosts = await client.fetch(`count(*[_type == "post"])`)
  const postsPerSitemap = 1000
  const sitemapCount = Math.ceil(totalPosts / postsPerSitemap)
  
  return Array.from({ length: sitemapCount }, (_, i) => ({ id: i }))
}
```

```typescript
// src/app/blog/sitemap/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const start = id * 1000
  const end = start + 1000

  const posts = await client.fetch(
    `*[_type == "post"] | order(_createdAt) [$start...$end]{ slug, _updatedAt }`,
    { start, end }
  )

  // Generate sitemap XML...
}
```

### robots.txt

**`src/app/robots.ts`:**

```typescript
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://example.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/studio/', '/admin/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

### Dynamic OG Images

Generate Open Graph images on-the-fly using Next.js `ImageResponse`:

**`src/app/blog/[slug]/opengraph-image.tsx`:**

```typescript
import { ImageResponse } from 'next/og'
import { client } from '@/sanity/lib/client'

export const runtime = 'edge'
export const alt = 'Blog post image'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const OG_QUERY = /* groq */ `
  *[_type == "post" && slug.current == $slug][0]{
    title,
    author->{ name }
  }
`

export default async function OGImage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  const post = await client.fetch(OG_QUERY, { slug: params.slug })

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          padding: 60,
        }}
      >
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          {post?.title || 'Blog Post'}
        </div>
        {post?.author?.name && (
          <div
            style={{
              marginTop: 30,
              fontSize: 30,
              color: '#888',
            }}
          >
            By {post.author.name}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 24,
            color: '#666',
          }}
        >
          example.com
        </div>
      </div>
    ),
    { ...size }
  )
}
```

### OG Image with Custom Fonts

```typescript
import { ImageResponse } from 'next/og'

// Load font
const interBold = fetch(
  new URL('./Inter-Bold.ttf', import.meta.url)
).then((res) => res.arrayBuffer())

export default async function OGImage({ params }) {
  const fontData = await interBold
  
  return new ImageResponse(
    (
      <div style={{ fontFamily: 'Inter' }}>
        {/* ... */}
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  )
}
```

### OG Image with Sanity Image

Fetch and display a Sanity image in your OG image:

```typescript
import { ImageResponse } from 'next/og'
import { urlFor } from '@/sanity/lib/image'

export default async function OGImage({ params }) {
  const post = await client.fetch(OG_QUERY, { slug: params.slug })
  
  const imageUrl = post?.mainImage 
    ? urlFor(post.mainImage).width(1200).height(630).url()
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
        }}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 40,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700 }}>
            {post?.title}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
```

### Reusable OG Image Template

Create a shared template for consistent branding:

```typescript
// src/lib/og-template.tsx
export function OGTemplate({ 
  title, 
  subtitle,
  imageUrl,
}: { 
  title: string
  subtitle?: string
  imageUrl?: string
}) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        backgroundImage: imageUrl 
          ? `url(${imageUrl})`
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundSize: 'cover',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 60,
          background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.9))',
        }}
      >
        <div style={{ color: 'white', fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: '#94a3b8', fontSize: 28, marginTop: 16 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
```

### Pages Router Sitemap

For Pages Router, use `getServerSideProps`:

```typescript
// pages/sitemap.xml.tsx
import { GetServerSideProps } from 'next'
import { client } from '@/sanity/lib/client'

function Sitemap() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const baseUrl = 'https://example.com'
  const documents = await client.fetch(SITEMAP_QUERY)

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${documents
        .map((doc: any) => `
          <url>
            <loc>${baseUrl}/${doc.slug}</loc>
            <lastmod>${doc._updatedAt}</lastmod>
          </url>
        `)
        .join('')}
    </urlset>`

  res.setHeader('Content-Type', 'text/xml')
  res.write(sitemap)
  res.end()

  return { props: {} }
}

export default Sitemap
```

Reference: [Next.js Metadata Files](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
