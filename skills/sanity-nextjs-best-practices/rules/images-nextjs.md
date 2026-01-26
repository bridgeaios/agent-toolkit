---
title: Images with next/image
description: Integrate Sanity images with Next.js Image component, urlFor, and LQIP placeholders
tags: nextjs, images, next-image, urlFor, lqip, blur-placeholder
---

## Images with next/image

Sanity's image pipeline combined with `next/image` provides optimized, responsive images with blur placeholders.

### Schema: Always Enable Hotspot

```typescript
import { defineField } from 'sanity'

defineField({
  name: 'mainImage',
  title: 'Main Image',
  type: 'image',
  options: {
    hotspot: true, // Allow editors to set focal point
  },
  fields: [
    defineField({
      name: 'alt',
      type: 'string',
      title: 'Alternative Text',
      validation: (rule) => rule.required().warning('Alt text improves SEO'),
    }),
  ],
})
```

### URL Builder Setup

**`src/sanity/lib/image.ts`:**

```typescript
import createImageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!

const builder = createImageUrlBuilder({ projectId, dataset })

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}
```

### Querying Images with LQIP

**Critical:** LQIP (Low Quality Image Placeholder) is **not automatic**. You must query it explicitly.

**Minimal query (no blur placeholder):**

```groq
mainImage {
  asset->{ _id, url },
  alt
}
```

**Full query (with LQIP and dimensions):**

```groq
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

### Reusable Image Fragment

```typescript
// src/sanity/lib/fragments.ts
export const imageFragment = /* groq */ `
  asset->{
    _id,
    url,
    metadata {
      lqip,
      dimensions { width, height }
    }
  },
  alt,
  hotspot,
  crop
`
```

Use in queries:

```typescript
import { imageFragment } from './fragments'

const POST_QUERY = defineQuery(`
  *[_type == "post"][0]{
    title,
    mainImage { ${imageFragment} }
  }
`)
```

### SanityImage Component

Create a reusable component that handles all the integration:

```typescript
// src/components/SanityImage.tsx
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'

type SanityImageValue = {
  asset?: {
    _id: string
    url: string
    metadata?: {
      lqip?: string
      dimensions?: { width: number; height: number }
    }
  }
  alt?: string
  hotspot?: { x: number; y: number }
  crop?: { top: number; bottom: number; left: number; right: number }
}

type SanityImageProps = {
  value: SanityImageValue
  width?: number
  height?: number
  sizes?: string
  className?: string
  priority?: boolean
  fill?: boolean
}

export function SanityImage({
  value,
  width = 800,
  height,
  sizes,
  className,
  priority = false,
  fill = false,
}: SanityImageProps) {
  if (!value?.asset) return null

  const dimensions = value.asset.metadata?.dimensions
  const aspectRatio = dimensions 
    ? dimensions.width / dimensions.height 
    : 1.5

  const computedHeight = height || Math.round(width / aspectRatio)

  // Build optimized URL
  const src = urlFor(value)
    .width(width)
    .height(computedHeight)
    .fit('crop')
    .url()

  const commonProps = {
    src,
    alt: value.alt || '',
    className,
    priority,
    placeholder: value.asset.metadata?.lqip ? 'blur' as const : 'empty' as const,
    blurDataURL: value.asset.metadata?.lqip,
  }

  if (fill) {
    return (
      <Image
        {...commonProps}
        fill
        sizes={sizes || '100vw'}
        style={{ objectFit: 'cover' }}
      />
    )
  }

  return (
    <Image
      {...commonProps}
      width={width}
      height={computedHeight}
      sizes={sizes}
    />
  )
}
```

### Usage Examples

**Basic usage:**

```typescript
<SanityImage value={post.mainImage} width={800} />
```

**Hero image (full width):**

```typescript
<div className="relative h-[60vh]">
  <SanityImage 
    value={page.heroImage} 
    fill 
    priority 
    sizes="100vw"
    className="object-cover"
  />
</div>
```

**Responsive card image:**

```typescript
<SanityImage 
  value={post.thumbnail} 
  width={400}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

### Hotspot-Aware Cropping

When using `fill` or specific crops, respect the editor's hotspot:

```typescript
function HotspotImage({ value, className }) {
  if (!value?.asset) return null

  const hotspot = value.hotspot || { x: 0.5, y: 0.5 }
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={urlFor(value).width(1200).url()}
        alt={value.alt || ''}
        fill
        style={{
          objectFit: 'cover',
          objectPosition: `${hotspot.x * 100}% ${hotspot.y * 100}%`,
        }}
      />
    </div>
  )
}
```

### Responsive Images with srcSet

For advanced responsive images:

```typescript
function ResponsiveImage({ value }) {
  const widths = [400, 800, 1200, 1600]
  
  return (
    <Image
      src={urlFor(value).width(1200).url()}
      alt={value.alt || ''}
      width={1200}
      height={800}
      sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
      // next/image handles srcSet automatically
    />
  )
}
```

### Performance Tips

| Tip | Why |
|-----|-----|
| Always query LQIP | Enables blur placeholder for better UX |
| Set explicit dimensions | Prevents Cumulative Layout Shift (CLS) |
| Use `priority` for LCP images | Improves Largest Contentful Paint |
| Use appropriate `sizes` | Helps browser pick right srcSet |
| Use Sanity CDN sizing | Don't download 4000px for thumbnails |

### Without LQIP

If you don't query `metadata.lqip`, the blur effect won't work:

```typescript
// This won't show blur placeholder
<Image
  src={urlFor(value).url()}
  placeholder="blur"
  blurDataURL={value.asset.metadata?.lqip} // undefined!
/>
```

Always include LQIP in your image queries for the best user experience.

### next.config.js Setup

Allow Sanity CDN images:

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
}
```

Reference: [Sanity Image URLs](https://www.sanity.io/docs/image-urls)
