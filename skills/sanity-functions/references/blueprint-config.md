# Blueprint Configuration Reference

Complete reference for configuring Sanity Functions via Blueprints. Blueprints are declarative resource definitions in `sanity.blueprint.ts` that tell Sanity which functions to deploy and how to trigger them.

## Setup

### Initialize a Blueprint

```bash
npx sanity@latest blueprints init . \
  --type ts \
  --stack-name production \
  --project-id <your-project-id>
```

Creates `sanity.blueprint.ts` and `blueprint.config.ts` in your project root.

### Scaffold a Function

```bash
npx sanity@latest blueprints add function \
  --name my-function \
  --fn-type document-publish \
  --installer npm
```

`--fn-type` options: `document-create`, `document-update`, `document-publish`, `document-delete`.

---

## `defineBlueprint`

Top-level wrapper. Takes a `resources` array of function definitions.

```typescript
import { defineBlueprint, defineDocumentFunction } from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    // one or more function definitions
  ],
})
```

---

## `defineDocumentFunction`

Defines a function triggered by document lifecycle events.

```typescript
defineDocumentFunction({
  name: 'my-function',
  displayName: 'My Function',         // optional, human-readable name
  src: 'functions/my-function',       // optional, inferred from name
  memory: 1,                          // GB, default 1, max 10
  timeout: 10,                        // seconds, default 10, max 900
  runtime: 'nodejs22.x',              // 'node' | 'nodejs22.x' | 'nodejs24.x'
  project: 'yourProjectId',           // optional, required if blueprint is org-scoped
  robotToken: 'token-name',           // optional, custom robot token
  event: {
    on: ['create', 'update'],
    filter: '_type == "post"',
    projection: '{title, _id, _type, slug}',
    includeDrafts: false,              // default false
    includeAllVersions: false,         // default false
    resource: {
      type: 'dataset',
      id: 'projectId.datasetName',
    },
  },
  env: {
    MY_VAR: 'value',
  },
})
```

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | required | Function name. Must match the directory name under `functions/`. |
| `displayName` | `string` | — | Human-readable display name for the function. |
| `src` | `string` | `functions/<name>` | Path to the function source directory. |
| `memory` | `number` | `1` | Memory allocation in GB. Max 10. |
| `timeout` | `number` | `10` | Execution timeout in seconds. Max 900. |
| `runtime` | `string` | `'nodejs22.x'` | Runtime environment: `'node'`, `'nodejs22.x'`, or `'nodejs24.x'`. |
| `project` | `string` | — | Project ID. Required if the blueprint is scoped to an organization. |
| `robotToken` | `string` | — | Custom robot token name for the function. |
| `event` | `object` | required | Event configuration (see below). |
| `env` | `Record<string, string>` | — | Environment variables available via `process.env`. |

### `event` Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `on` | `string[]` | required | Event types: `'create'`, `'update'`, `'delete'`. The legacy `'publish'` event (equivalent to `['create', 'update']`) is deprecated. |
| `filter` | `string` | — | GROQ filter expression (body only, no `*[...]` wrapper). |
| `projection` | `string` | — | GROQ projection to shape `event.data`. Wrap in `{}`. |
| `includeDrafts` | `boolean` | `false` | Whether to trigger on draft document changes. |
| `includeAllVersions` | `boolean` | `false` | Whether to trigger on all document versions. |
| `resource` | `object` | — | Scope to a specific dataset: `{ type: 'dataset', id: 'projectId.datasetName' }`. |

---

## `defineMediaLibraryAssetFunction`

Defines a function triggered by Media Library asset events. Requires `@sanity/blueprints` v0.4.0+ and `@sanity/functions` v1.1.0+.

```typescript
import { defineBlueprint, defineMediaLibraryAssetFunction } from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineMediaLibraryAssetFunction({
      name: 'asset-handler',
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

### `resource` for Media Library

| Option | Type | Description |
| :--- | :--- | :--- |
| `type` | `'media-library'` | Must be `'media-library'`. |
| `id` | `string` | The Media Library ID (e.g., `'mlYourLibraryId'`). |

All other options (`name`, `src`, `memory`, `timeout`, `env`, `event.on`, `event.filter`, `event.projection`) behave the same as `defineDocumentFunction`.

---

## Multiple Functions

A single blueprint can define multiple functions:

```typescript
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

Each function needs its own directory under `functions/`.

---

## Environment Variables

Three ways to set them:

1. In the blueprint config: `env: { MY_VAR: 'value' }`
2. Via CLI: `npx sanity functions env add my-function MY_VAR my-value`
3. For local testing: `MY_VAR=value npx sanity functions test my-function`

Access in handler code via `process.env.MY_VAR`.

---

## Deployment & Lifecycle

```bash
# Deploy all functions defined in the blueprint
npx sanity@latest blueprints deploy

# View logs
npx sanity@latest functions logs my-function
npx sanity@latest functions logs my-function --watch

# Tear down all deployed resources
npx sanity@latest blueprints destroy
```

---

## GROQ Filter Tips

- Only the filter body — use `_type == 'post'`, not `*[_type == 'post']`
- `delta::changedAny(fieldName)` — trigger only when specific fields change
- `sanity::dataset() == 'production'` — scope to a dataset without `resource` config
- `_id in path('drafts.**')` with `includeDrafts: true` — draft-only triggers
- Combine conditions to prevent recursion: `_type == 'post' && !defined(processedAt)`
