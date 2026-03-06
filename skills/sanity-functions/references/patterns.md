# Common Function Patterns

Ready-to-use patterns for Sanity Functions. Each includes the blueprint config and handler code.

---

## 1. Ping a deploy hook / invalidate CDN

Triggers an external URL when content publishes. Works for Vercel, Netlify, Cloudflare, etc.

**Blueprint:**
```typescript
defineDocumentFunction({
  name: 'deploy-hook',
  event: {
    on: ['create', 'update'],
    filter: '_type == "page"',
  },
})
```

**Handler:**
```typescript
import { documentEventHandler } from '@sanity/functions'

export const handler = documentEventHandler(async ({ context, event }) => {
  const URL = process.env.DEPLOY_HOOK_URL
  if (!URL) throw new Error('DEPLOY_HOOK_URL is not set')

  try {
    await fetch(URL)
    console.log('Deploy hook triggered successfully')
  } catch (error) {
    console.error('Failed to trigger deploy hook:', error)
  }
})
```

Set the env var: `npx sanity functions env add deploy-hook DEPLOY_HOOK_URL https://...`

---

## 2. Set a timestamp on first publish

Sets a `firstPublished` field once, never overwriting it.

**Blueprint:**
```typescript
defineDocumentFunction({
  name: 'first-published',
  event: {
    on: ['create', 'update'],
    filter: '_type == "post" && !defined(firstPublished)',
  },
})
```

**Handler:**
```typescript
import { documentEventHandler } from '@sanity/functions'
import { createClient } from '@sanity/client'

interface PostData { _id: string }

export const handler = documentEventHandler<PostData>(async ({ context, event }) => {
  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-08',
  })

  try {
    await client.patch(event.data._id, {
      setIfMissing: { firstPublished: new Date().toISOString() },
    })
    console.log(`firstPublished set on ${event.data._id}`)
  } catch (error) {
    console.error(error)
  }
})
```

The `!defined(firstPublished)` filter prevents the function from running again after the field is set. The `setIfMissing` patch is a redundant safety net.

---

## 3. Auto-translate with Agent Actions

Translates documents automatically when published in a source language.

**Blueprint:**
```typescript
defineDocumentFunction({
  name: 'translate',
  event: {
    on: ['create', 'update'],
    filter: "_type == 'post' && language == 'en-US'",
    projection: '{_id}',
  },
})
```

**Handler:**
```typescript
import { documentEventHandler } from '@sanity/functions'
import { createClient } from '@sanity/client'

export const handler = documentEventHandler(async ({ context, event }) => {
  const { data } = event
  const client = createClient({
    ...context.clientOptions,
    apiVersion: 'vX',
  })

  const targetLanguage = { id: 'el-GR', title: 'Greek' }
  const targetId = `${data._id}-${targetLanguage.id}`

  try {
    await client.agent.action.translate({
      schemaId: 'your-schema-id',
      async: true,
      documentId: data._id,
      languageFieldPath: 'language',
      targetDocument: {
        operation: 'createOrReplace',
        _id: targetId,
      },
      fromLanguage: { id: 'en-US', title: 'English' },
      toLanguage: targetLanguage,
    })
    console.log(`Translation triggered for ${data._id}`)
  } catch (error) {
    console.error(error)
  }
})
```

The GROQ filter ensures only English documents trigger the function. The translated document gets a different `language` value, preventing recursive triggers.

---

## 4. Scope to a specific dataset

**Option A: Using the `resource` config:**
```typescript
defineDocumentFunction({
  name: 'production-only',
  event: {
    on: ['update'],
    filter: "_type == 'post'",
    resource: {
      type: 'dataset',
      id: 'myProjectId.production',
    },
  },
})
```

**Option B: Using a GROQ filter:**
```typescript
defineDocumentFunction({
  name: 'production-only',
  event: {
    on: ['update'],
    filter: "_type == 'post' && sanity::dataset() == 'production'",
  },
})
```

---

## 5. React to Media Library asset changes

Requires `@sanity/blueprints` v0.4.0+ and `@sanity/functions` v1.1.0+.

**Blueprint:**
```typescript
import { defineBlueprint, defineMediaLibraryAssetFunction } from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineMediaLibraryAssetFunction({
      name: 'asset-deleted',
      event: {
        on: ['delete'],
        filter: 'documents::incomingGlobalDocumentReferenceCount() > 0',
        projection: '{_id, versions, title}',
        resource: {
          type: 'media-library',
          id: 'mlYourLibraryId',
        },
      },
    }),
  ],
})
```

**Handler (accessing ML with client):**
```typescript
import { documentEventHandler } from '@sanity/functions'
import { createClient } from '@sanity/client'

export const handler = documentEventHandler(async ({ context, event }) => {
  const { eventResourceId } = context  // Media Library ID
  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-08',
  })

  const response = await client.request({
    uri: `/media-libraries/${eventResourceId}/query`,
    method: 'POST',
    body: { query: `*[_type == 'sanity.imageAsset']` },
  })

  console.log('Assets:', response)
})
```

---

## 6. Send a Slack notification on publish

**Handler:**
```typescript
import { documentEventHandler } from '@sanity/functions'

export const handler = documentEventHandler(async ({ context, event }) => {
  const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
  if (!WEBHOOK_URL) throw new Error('SLACK_WEBHOOK_URL not set')

  const { data } = event

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `📝 New content published: *${data.title || data._id}* (${data._type})`,
      }),
    })
    console.log('Slack notification sent')
  } catch (error) {
    console.error('Failed to send Slack notification:', error)
  }
})
```

---

## 7. Prevent accidental writes during local testing

Use `context.local` to guard mutations:

```typescript
import { documentEventHandler } from '@sanity/functions'
import { createClient } from '@sanity/client'

export const handler = documentEventHandler(async ({ context, event }) => {
  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-08',
  })

  // Approach 1: Skip mutations entirely in test
  if (!context.local) {
    await client.createOrReplace(someDoc)
  }

  // Approach 2: Use dryRun
  await client.patch(event.data._id, {
    set: { processed: true },
  }).commit({ dryRun: context.local })

  // Approach 3: Agent Actions with noWrite
  await client.agent.action.generate({
    schemaId: 'your-schema-id',
    documentId: event.data._id,
    instruction: 'Summarize this document',
    target: { path: ['summary'] },
    noWrite: context.local,
  })
})
```

---

## 8. Auto-tag content with Agent Actions

**Blueprint:**
```typescript
defineDocumentFunction({
  name: 'auto-tag',
  event: {
    on: ['create', 'update'],
    filter: "_type == 'post'",
    projection: '{_id, title, body}',
  },
})
```

**Handler:**
```typescript
import { documentEventHandler } from '@sanity/functions'
import { createClient } from '@sanity/client'

export const handler = documentEventHandler(async ({ context, event }) => {
  const client = createClient({
    ...context.clientOptions,
    apiVersion: 'vX',
  })

  try {
    await client.agent.action.generate({
      schemaId: 'your-schema-id',
      documentId: event.data._id,
      instruction: 'Analyze the content and generate 3 relevant tags. Reuse existing tags when possible.',
      target: { path: ['tags'] },
      async: true,
    })
    console.log(`Auto-tagging triggered for ${event.data._id}`)
  } catch (error) {
    console.error(error)
  }
})
```

---

## 9. Enable recursion control with custom HTTP clients

If not using `@sanity/client`, implement lineage tracking manually:

```typescript
import { documentEventHandler } from '@sanity/functions'

export const handler = documentEventHandler(async ({ context, event }) => {
  const lineage = process.env.X_SANITY_LINEAGE

  await fetch(`https://${context.clientOptions.projectId}.api.sanity.io/v2025-05-08/data/mutate/production`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.clientOptions.token}`,
      ...(lineage ? { 'X-Sanity-Lineage': lineage } : {}),
    },
    body: JSON.stringify({
      mutations: [{ patch: { id: event.data._id, set: { processed: true } } }],
    }),
  })
})
```

---

## 10. Multiple functions in one blueprint

```typescript
import { defineBlueprint, defineDocumentFunction } from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'first-published',
      event: {
        on: ['create', 'update'],
        filter: "_type == 'post' && !defined(firstPublished)",
      },
    }),
    defineDocumentFunction({
      name: 'notify-slack',
      event: {
        on: ['create', 'update'],
        filter: "_type == 'post'",
        projection: '{title, _id}',
      },
    }),
    defineDocumentFunction({
      name: 'sync-algolia',
      timeout: 30,
      event: {
        on: ['create', 'update', 'delete'],
        filter: "_type == 'product'",
      },
    }),
  ],
})
```

Each function gets its own directory under `functions/`.
