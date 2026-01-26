---
title: Visual Editing Setup
description: Configure Draft Mode, VisualEditing component, and Presentation Tool for click-to-edit
tags: nextjs, visual-editing, draft-mode, presentation-tool, overlays
---

## Visual Editing Setup

Visual Editing enables click-to-edit functionality in your Next.js preview. Editors can click any content in the preview to jump directly to that field in Sanity Studio.

### How It Works

1. **Content Source Maps (Stega)**: Sanity encodes document/field info as invisible characters in strings
2. **Overlays**: The `VisualEditing` component renders clickable overlays on editable content
3. **Presentation Tool**: Studio plugin that renders your site in an iframe with bidirectional navigation

### Token Security

Store your read token in a dedicated file that throws if missing. Never expose tokens in client bundles.

**`src/sanity/lib/token.ts`:**

```typescript
export const token = process.env.SANITY_API_READ_TOKEN

if (!token) {
  throw new Error('Missing SANITY_API_READ_TOKEN')
}
```

### App Router Setup

**1. Enable Draft Mode API Route (`src/app/api/draft-mode/enable/route.ts`):**

```typescript
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { defineEnableDraftMode } from 'next-sanity/draft-mode'

export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token }),
})
```

**2. Disable Draft Mode (`src/app/api/draft-mode/disable/route.ts`):**

```typescript
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  const draft = await draftMode()
  draft.disable()
  // Allow time for the cookie to be set
  await new Promise((resolve) => setTimeout(resolve, 100))
  redirect('/')
}
```

**3. Add VisualEditing to Layout (`src/app/layout.tsx`):**

```typescript
import { SanityLive } from '@/sanity/lib/live'
import { VisualEditing } from 'next-sanity/visual-editing'
import { draftMode } from 'next/headers'

export default async function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
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

### Disable Draft Mode Button

Let editors exit preview mode when browsing outside the Presentation Tool:

```typescript
// src/components/DisableDraftMode.tsx
'use client'
import { useDraftModeEnvironment } from 'next-sanity/hooks'

export function DisableDraftMode() {
  const environment = useDraftModeEnvironment()
  
  // Only show outside of Presentation Tool
  if (environment !== 'live' && environment !== 'unknown') return null

  return (
    <a 
      href="/api/draft-mode/disable" 
      className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded shadow-lg z-50"
    >
      Exit Draft Mode
    </a>
  )
}
```

Add to layout:

```typescript
{(await draftMode()).isEnabled && (
  <>
    <DisableDraftMode />
    <VisualEditing />
  </>
)}
```

### Presentation Tool Configuration

Configure the Presentation Tool in your Studio config:

**`sanity.config.ts`:**

```typescript
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

### Document Locations

Tell the Presentation Tool where documents appear on your site:

```typescript
// src/sanity/presentation/resolve.ts
import { 
  defineLocations, 
  PresentationPluginOptions 
} from 'sanity/presentation'

export const resolve: PresentationPluginOptions['resolve'] = {
  locations: {
    // Post documents
    post: defineLocations({
      select: { 
        title: 'title', 
        slug: 'slug.current' 
      },
      resolve: (doc) => ({
        locations: [
          { 
            title: doc?.title || 'Untitled', 
            href: `/blog/${doc?.slug}` 
          },
          { 
            title: 'Blog index', 
            href: '/blog' 
          },
        ],
      }),
    }),
    
    // Page documents
    page: defineLocations({
      select: { 
        title: 'title', 
        slug: 'slug.current' 
      },
      resolve: (doc) => ({
        locations: doc?.slug === 'home'
          ? [{ title: 'Homepage', href: '/' }]
          : [{ title: doc?.title || 'Untitled', href: `/${doc?.slug}` }],
      }),
    }),
    
    // Settings singleton
    settings: defineLocations({
      message: 'This document is used on all pages',
      tone: 'caution',
    }),
  },
}
```

### Embedded Studio Setup

Mount the Studio on a Next.js route:

**`src/app/studio/[[...tool]]/page.tsx`:**

```typescript
import { NextStudio } from 'next-sanity/studio'
import config from '../../../../sanity.config'

export const dynamic = 'force-static'

export { metadata, viewport } from 'next-sanity/studio'

export default function StudioPage() {
  return <NextStudio config={config} />
}
```

### Pages Router Setup

For Pages Router, use Preview Mode instead of Draft Mode:

**1. Preview API route** - See `data-fetching-pages-router.md`

**2. Add visual editing to `_app.tsx`:**

```typescript
// pages/_app.tsx
import { useRouter } from 'next/router'
import { VisualEditing } from 'next-sanity/visual-editing'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const { preview } = pageProps

  return (
    <>
      <Component {...pageProps} />
      {preview && <VisualEditing />}
    </>
  )
}
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Overlays not appearing | Check `VisualEditing` is rendered in draft mode |
| Click-to-edit not working | Ensure stega encoding is enabled in client config |
| "Invalid token" error | Verify `SANITY_API_READ_TOKEN` is set correctly |
| CORS errors | Add your site URL to CORS origins in Sanity |
| Preview shows published content | Check client is using token and correct perspective |

### Environment Variables

Required for Visual Editing:

```env
# .env.local
SANITY_API_READ_TOKEN=sk...      # Viewer or Editor token
SANITY_PREVIEW_SECRET=mysecret   # For Preview Mode (Pages Router)
```

Reference: [Visual Editing documentation](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing)
