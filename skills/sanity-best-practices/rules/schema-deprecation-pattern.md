---
title: Safe Field Deprecation Pattern
description: Never delete fields with data - use the ReadOnly → Hidden → Deprecated lifecycle
tags: schema, migration, deprecation, safety
---

## Safe Field Deprecation Pattern

**NEVER** delete a field that contains production data. It causes data loss or Studio crashes. Instead, follow the ReadOnly → Hidden → Deprecated lifecycle.

**Incorrect (dangerous):**

```typescript
// ❌ NEVER do this - deleting a field with existing data
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

### Migration Workflow

**Phase 1: Deprecate**
1. Apply the deprecation pattern above
2. Deploy schema changes

**Phase 2: Migrate**
1. Update frontend to use new fields (with fallbacks)
2. Run migration script to move data:

```typescript
// Migration script example
const documents = await client.fetch(`*[_type == "article" && defined(oldTitle)]`)

for (const doc of documents) {
  await client.patch(doc._id)
    .set({ newTitle: doc.oldTitle })
    .unset(['oldTitle'])
    .commit()
}
```

**Phase 3: Remove**
1. Verify `oldTitle` is undefined for all documents
2. Delete the field definition from schema

Reference: [Schema and Content Migrations](https://www.sanity.io/docs/content-lake/schema-and-content-migrations)
