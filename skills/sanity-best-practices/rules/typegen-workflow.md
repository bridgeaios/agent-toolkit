---
title: TypeGen Update Workflow
description: Run extract then generate after schema or query changes
tags: typegen, typescript, workflow, types
---

## TypeGen Update Workflow

TypeGen generates types from your schema and GROQ queries. Enable automatic generation or run manually.

> For full configuration details, project structure examples, type utilities, and advanced patterns, see `rules/sanity-typegen.mdc`.

### Automatic Generation (Recommended)

Enable in `sanity.cli.ts` — types regenerate during `sanity dev` and `sanity build`:

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

### Manual Generation

```json
{
  "scripts": {
    "typegen": "sanity schema extract && sanity typegen generate"
  }
}
```

### Configuration

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

### Usage

With `overloadClientMethods: true` (default), `client.fetch()` returns typed results automatically:

```typescript
import { defineQuery } from "groq";

const POST_QUERY = defineQuery(`*[_type == "post"]{ title, slug }`)

// Return type is inferred automatically — no manual type import needed!
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
