---
name: sanity-functions
description: Guide for creating, testing, and deploying Sanity Functions — serverless event handlers that react to content changes in Sanity's Content Lake. Use this skill whenever the user mentions Sanity Functions, Blueprints for Functions, event-driven content automation, document event handlers, content workflows with Sanity, or wants to write code that runs when Sanity documents are created, updated, deleted, or published. Also trigger when the user mentions @sanity/functions, @sanity/blueprints, documentEventHandler, defineDocumentFunction, defineMediaLibraryAssetFunction, or sanity.blueprint.ts. Even if the user just says "I want to run code when content changes in Sanity" or "automate something on publish," use this skill.
---

# Sanity Functions Development Guide

## Overview

Sanity Functions are serverless event handlers hosted on Sanity's infrastructure. They execute custom logic when content changes occur — no infrastructure management required. Functions are configured via **Blueprints** (declarative resource definitions) and triggered by document lifecycle events.

> **Experimental feature**: APIs are subject to change. Always use the latest Sanity CLI (`npx sanity@latest`).

## When to use Functions

- Enrich, validate, or constrain content on publish
- Trigger external services (CDN purge, deploy hooks, notifications)
- Automate workflows (translation, tagging, cross-posting)
- Sync content to external systems (Algolia, Elasticsearch)
- Set computed/derived fields (timestamps, slugs, summaries)
- Invoke Agent Actions (Generate, Transform, Translate) in response to content events

## When NOT to use Functions

- When your logic needs to run longer than 900 seconds (15 min max timeout).
- When your dependencies exceed 200MB — native code wrappers or heavy SDKs won't fit.
- When you'd be mutating the same document type you're listening to without a reliable way to break the recursion loop (GROQ filter exclusion or a sentinel field). It's technically possible with guards, but if the logic is complex, you're asking for trouble.
- When the work is purely client-side or UI-driven (form validation, conditional field visibility) — that belongs in the Studio schema config, not a serverless function.


## Requirements

- **Node.js v24.x** — matches the deployed runtime
- **Sanity CLI v4.12.0+** — use `npx sanity@latest` for latest
- **@sanity/blueprints** — for blueprint configuration helpers
- **@sanity/functions** — for handler types and the `documentEventHandler` wrapper
- **@sanity/client v7.12.0+** — includes recursion protection via lineage headers

---

## Architecture

### How it works

1. Content changes in Sanity's Content Lake emit events
2. A Blueprint configuration defines which events trigger which functions (using GROQ filters)
3. The function handler receives `context` (client config, metadata) and `event` (document data)
4. The function executes custom logic — patching documents, calling APIs, invoking Agent Actions

### Project structure

Organize functions alongside your Sanity project, one level above the Studio directory:

```
my-project/
├── studio/
├── next-app/
├── functions/
│   ├── my-function/
│   │   ├── index.ts          # Handler code (entry point)
│   │   └── package.json      # (optional) function-level dependencies
│   └── another-function/
│       └── index.ts
├── sanity.blueprint.ts        # Blueprint configuration
├── package.json               # Project-level dependencies
└── node_modules/
```

The function directory name must match the `name` in the blueprint config. Each function exports a `handler` from its `index.ts` (or `index.js`).

---

## Step-by-step: Creating a Function

### 1. Initialize a Blueprint

From your project root (above the studio directory):

```bash
npx sanity@latest blueprints init . \
  --type ts \
  --stack-name production \
  --project-id <your-project-id>
```

This creates `sanity.blueprint.ts` and `blueprint.config.ts`.

### 2. Add a Function

```bash
npx sanity@latest blueprints add function \
  --name my-function \
  --fn-type document-publish \
  --installer npm
```

Options for `--fn-type`: `document-create`, `document-update`, `document-publish` (deprecated), `document-delete`.

This scaffolds `functions/my-function/index.ts` and prompts you to update the blueprint file.

### 3. Configure the Blueprint

```typescript
// sanity.blueprint.ts
import { defineBlueprint, defineDocumentFunction } from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'my-function',
      // Optional overrides:
      // displayName: 'My Function',    // human-readable name
      // src: 'functions/my-function',  // inferred from name if omitted
      // memory: 1,                     // GB, default 1, max 10
      // timeout: 10,                   // seconds, default 10, max 900
      // runtime: 'nodejs22.x',         // 'node' | 'nodejs22.x' | 'nodejs24.x'
      event: {
        on: ['create', 'update'],
        filter: '_type == "post"',
        // projection: '{title, _id, _type, slug}',
        // includeDrafts: false,         // default false
        // includeAllVersions: false,    // default false
        // resource: { type: 'dataset', id: 'projectId.datasetName' },
      },
      // env: { MY_VAR: 'value' },
    }),
  ],
})
```

### 4. Write the Handler

**TypeScript (recommended):**

```typescript
// functions/my-function/index.ts
import { documentEventHandler } from '@sanity/functions'
import { createClient } from '@sanity/client'

interface PostData {
  _id: string
  _type: string
  title: string
}

export const handler = documentEventHandler<PostData>(async ({ context, event }) => {
  const { data } = event

  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-08',
  })

  try {
    await client.patch(data._id, {
      setIfMissing: { firstPublished: new Date().toISOString() },
    })
    console.log(`Set firstPublished on ${data._id}`)
  } catch (error) {
    console.error('Failed to patch document:', error)
  }
})
```

**JavaScript alternative:**

```javascript
// functions/my-function/index.js
import { createClient } from '@sanity/client'

export async function handler({ context, event }) {
  const { data } = event
  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-08',
  })

  // your logic here
}
```

### 5. Test Locally

**Development playground (visual UI):**

```bash
npx sanity@latest functions dev
# Opens http://localhost:8080
```

**CLI testing:**

```bash
npx sanity@latest functions test my-function \
  --dataset production \
  --with-user-token

# Or with a specific document:
npx sanity@latest functions test my-function \
  --document-id abc123 \
  --dataset production \
  --with-user-token

# Or with a file:
npx sanity@latest functions test my-function \
  --file sample-document.json
```

### 6. Deploy

```bash
npx sanity@latest blueprints deploy
```

### 7. View Logs

```bash
npx sanity@latest functions logs my-function
# Stream in real-time:
npx sanity@latest functions logs my-function --watch
```

### 8. Destroy (cleanup)

```bash
npx sanity@latest blueprints destroy
```

---

## Handler Reference

Every handler receives `{ context, event }`:

### `context`

```typescript
{
  clientOptions: {
    apiHost: 'https://api.sanity.io',
    projectId: 'abc123',
    dataset: 'production',
    token: '***'            // robot token, available in deployed functions
  },
  local: boolean | undefined, // true during `functions test` / `functions dev`
  eventResourceType: string,  // 'dataset' or 'media-library'
  eventResourceId: string,    // e.g., 'projectId.datasetName' or ML ID
}
```

### `event`

```typescript
{
  data: {
    _id: string,
    _type: string,
    // ... rest of document (shaped by projection if set)
  }
}
```

When testing locally, `context.clientOptions` only has `projectId` and `apiHost`. Use `--dataset` and `--with-user-token` flags to supply the rest.

---

## Blueprint Configuration Reference

See `references/blueprint-config.md` for the full configuration reference including all `defineDocumentFunction` and `defineMediaLibraryAssetFunction` options.

## Common Patterns

See `references/patterns.md` for ready-to-use patterns including: CDN invalidation, auto-translation with Agent Actions, setting computed fields, dataset scoping, Media Library functions, draft/version targeting, and recursion control.

---

## Critical Guidance

### Preventing recursion

If your function mutates the same document type it listens to, you **will** create an infinite loop. Prevent this by:

1. **Use GROQ filters** to exclude already-processed documents: `_type == 'post' && !defined(firstPublished)`
2. **Use `@sanity/client` v7.12.0+** which automatically sets the `X-Sanity-Lineage` header for recursion detection. Recursive chains are limited to 16 invocations.
3. **Create drafts/versions** instead of writing to published documents directly
4. Rate limits apply: 200 invocations per function per 30s, 4000 per project per 30s

### Keeping functions small

- Max size: 200MB (including dependencies)
- Prefer slim, platform-agnostic packages — no native code wrappers
- Split large logic across multiple functions
- Larger functions = slower cold starts

### Environment variables

- Access via `process.env.MY_VAR`
- Set in blueprint config: `env: { MY_VAR: 'value' }`
- Or via CLI: `npx sanity functions env add my-function MY_VAR my-value`
- For local testing, prepend to the command: `MY_VAR=value npx sanity functions test my-function`

### Local testing safety

Use `context.local` to prevent accidental mutations during testing:

```typescript
if (!context.local) {
  await client.createOrReplace(doc)
}
// Or use dryRun:
await client.patch(id, ops).commit({ dryRun: context.local })
```

### Projections

- Projections shape the data passed to `event.data`
- Limited to the invoking document's scope (plus `→` for references)
- Nested filters in projections (like `*[references(^._id)]`) will fail silently — query inside the function instead
- Wrap projection in `{}` to receive an object: `projection: '{title, _id, slug}'`

### GROQ filter tips

- Only include the filter body, not the wrapping `*[...]`
- Use `_type == 'post'` not `*[_type == 'post']`
- Use `delta::changedAny(fieldName)` to trigger only when specific fields change
- Use `sanity::dataset() == 'production'` to scope to a dataset without the `resource` config
- Use `_id in path('drafts.**')` with `includeDrafts: true` for draft-only triggers

### Event types

- `create` — new document created
- `update` — existing document modified
- `delete` — document deleted
- `publish` — **deprecated**, equivalent to `on: ['create', 'update']`. Migrate existing `on: ['publish']` to explicit `create`/`update` events.
- For published documents (default), `update` only fires when a draft/version is published. Often better to use `['create', 'update']` together.

### Cost considerations

Cost = invocations × (memory GB × duration seconds). Default is 1GB memory. A function averaging 1GB and 40ms duration can run ~500k invocations within 20K GB-seconds. <a href=https://www.sanity.io/manage>Monitor usage at the organization level.</a>

---

## CI/CD Deployment

Use the [Blueprints GitHub Action](https://github.com/sanity-io/blueprints-action) to deploy on merge:

```yaml
- uses: sanity-io/blueprints-action@v1
  with:
    sanity-token: ${{ secrets.SANITY_DEPLOY_TOKEN }}
```

Only personal auth tokens are supported for deployment (not robot tokens).
