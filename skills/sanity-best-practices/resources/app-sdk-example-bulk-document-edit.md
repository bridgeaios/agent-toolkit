---
title: "Bulk Document Edit"
description: "Interactive example showing how to build a bulk document editing table with Sanity UI. Demonstrates paginated document lists with usePaginatedDocuments, document type filtering, inline editing with useDocument and useEditDocument, bulk selection with checkboxes, and batch publish/unpublish using useApplyDocumentActions."
---

```tsx
import {
  usePaginatedDocuments,
  useDocument,
  useEditDocument,
  useDocumentProjection,
  useApplyDocumentActions,
  publishDocument,
  unpublishDocument,
} from '@sanity/sdk-react'
import {Suspense, useState, useCallback} from 'react'
import {Link} from 'react-router'
import {ThemeProvider, Card, Stack, Flex, Box, Text, TextInput, Checkbox, Button, Badge, Select} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
```

export const theme = buildTheme()

{/* ── InlineTitle ──────────────────────────────────────────────────────
    A single-field editor that reads and writes the `title` path on a
    document in real time.  `useDocument` returns the current draft value
    (suspending until it loads), and `useEditDocument` returns a setter
    that writes directly to the Content Lake — no local state needed.
*/}

export function InlineTitle({doc}) {
  const {data: title} = useDocument({...doc, path: 'title'})
  const editTitle = useEditDocument({...doc, path: 'title'})

  return (
```tsx
    <TextInput
      value={title ?? ''}
      onChange={(e) => editTitle(e.currentTarget.value)}
      fontSize={1}
      padding={2}
    />
  )
```

}

{/* ── DocumentMeta ────────────────────────────────────────────────────
    Uses `useDocumentProjection` to fetch only the `_updatedAt` timestamp.
    Projections are read-only and more efficient than `useDocument` when
    you don't need to write back.
*/}

export function DocumentMeta({doc}) {
  const {data} = useDocumentProjection({
    ...doc,
    projection: '{_updatedAt}',
  })

  return (
```tsx
    <Text size={1} muted>
      {data?._updatedAt
        ? new Date(data._updatedAt).toLocaleDateString()
        : '—'}
    </Text>
  )
```

}

{/* ── EditableRow ─────────────────────────────────────────────────────
    Renders one table row.  It does **not** call any data-fetching hooks
    itself — it delegates to `InlineTitle` and `DocumentMeta`, each
    wrapped in its own `<Suspense>` boundary so they load independently.
*/}

export function EditableRow({doc, selected, onToggle}) {
  return (
    <tr>
      <td style={{padding: '8px 12px', borderBottom: '1px solid var(--card-border-color)'}}>
```tsx
        <Checkbox checked={selected} onChange={() => onToggle(doc.documentId)} />
      </td>
      <td style={{padding: '8px 12px', borderBottom: '1px solid var(--card-border-color)', minWidth: 200}}>
        <Suspense fallback={<TextInput value="Loading…" readOnly fontSize={1} padding={2} />}>
          <InlineTitle doc={doc} />
        </Suspense>
      </td>
      <td style={{padding: '8px 12px', borderBottom: '1px solid var(--card-border-color)'}}>
        <Badge tone="primary" fontSize={0}>{doc.documentType}</Badge>
      </td>
      <td style={{padding: '8px 12px', borderBottom: '1px solid var(--card-border-color)'}}>
        <Suspense fallback={<Text size={1} muted>…</Text>}>
          <DocumentMeta doc={doc} />
        </Suspense>
      </td>
    </tr>
  )
```

}

{/* ── BulkDocumentEdit ────────────────────────────────────────────────
    The main container.  Fetches document handles via `usePaginatedDocuments`,
    tracks which rows are selected in a `Set`, provides a document type
    filter, page navigation, and bulk publish / unpublish actions.
*/}

export function BulkDocumentEdit() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const apply = useApplyDocumentActions()

  const {data, isPending, count, currentPage, totalPages, nextPage, previousPage, hasNextPage, hasPreviousPage} = usePaginatedDocuments({
    documentType: typeFilter || undefined,
    pageSize: 10,
    search: search || undefined,
    orderings: [{field: '_updatedAt', direction: 'desc'}],
  })

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === data.length
        ? new Set()
        : new Set(data.map((d) => d.documentId)),
    )
  }, [data])

  const handleBulkPublish = useCallback(async () => {
    const docs = data.filter((d) => selected.has(d.documentId))
    await Promise.all(docs.map((d) => apply(publishDocument(d))))
    setSelected(new Set())
  }, [data, selected, apply])

  const handleBulkUnpublish = useCallback(async () => {
    const docs = data.filter((d) => selected.has(d.documentId))
    await Promise.all(docs.map((d) => apply(unpublishDocument(d))))
    setSelected(new Set())
  }, [data, selected, apply])

  return (
```tsx
    <Stack space={4}>
      <Flex gap={3} align="flex-end">
        <Box flex={1}>
          <Stack space={2}>
            <Text size={1} weight="semibold">Search</Text>
            <TextInput
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              fontSize={1}
              padding={3}
            />
          </Stack>
        </Box>
        <Box style={{minWidth: 200}}>
          <Stack space={2}>
            <Text size={1} weight="semibold">Document type</Text>
            <TextInput
              placeholder="All types"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.currentTarget.value)}
              fontSize={1}
              padding={3}
            />
          </Stack>
        </Box>
      </Flex>

      <Flex gap={3} align="center">
        <Text size={1} muted>
          {count} document{count !== 1 ? 's' : ''} found
          {selected.size > 0 && ` · ${selected.size} selected`}
        </Text>
        <Box flex={1} />
        <Button
          text="Publish selected"
          tone="positive"
          fontSize={1}
          padding={3}
          disabled={selected.size === 0}
          onClick={handleBulkPublish}
        />
        <Button
          text="Unpublish selected"
          tone="caution"
          fontSize={1}
          padding={3}
          disabled={selected.size === 0}
          onClick={handleBulkUnpublish}
        />
      </Flex>

      <Card border radius={2} overflow="auto">
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{borderBottom: '2px solid var(--card-border-color)'}}>
              <th style={{padding: '10px 12px', textAlign: 'left', width: 40}}>
                <Checkbox
                  checked={data.length > 0 && selected.size === data.length}
                  onChange={toggleAll}
                />
              </th>
              <th style={{padding: '10px 12px', textAlign: 'left'}}>
                <Text size={1} weight="semibold">Title</Text>
              </th>
              <th style={{padding: '10px 12px', textAlign: 'left'}}>
                <Text size={1} weight="semibold">Type</Text>
              </th>
              <th style={{padding: '10px 12px', textAlign: 'left'}}>
                <Text size={1} weight="semibold">Updated</Text>
              </th>
            </tr>
          </thead>
          <tbody style={{opacity: isPending ? 0.6 : 1}}>
            {data.map((doc) => (
              <Suspense
                key={doc.documentId}
                fallback={
                  <tr>
                    <td colSpan={4} style={{padding: '8px 12px'}}>
                      <Text size={1} muted>Loading…</Text>
                    </td>
                  </tr>
                }
              >
                <EditableRow
                  doc={doc}
                  selected={selected.has(doc.documentId)}
                  onToggle={toggleSelect}
                />
              </Suspense>
            ))}
          </tbody>
        </table>
      </Card>

      <Flex gap={2} align="center" justify="center">
        <Button
          text="← Prev"
          mode="ghost"
          fontSize={1}
          padding={3}
          disabled={!hasPreviousPage || isPending}
          onClick={previousPage}
        />
        <Card padding={3} radius={2}>
          <Text size={1} align="center">
            Page {currentPage} of {totalPages}
          </Text>
        </Card>
        <Button
          text="Next →"
          mode="ghost"
          fontSize={1}
          padding={3}
          disabled={!hasNextPage || isPending}
          onClick={nextPage}
        />
      </Flex>
    </Stack>
  )
```

}

# Bulk Document Edit

A table-based interface for editing multiple documents at once. Filter by document
type, page through results, edit titles inline, and publish or unpublish in bulk —
all backed by real-time sync to the Sanity Content Lake.

This example combines several App SDK hooks with [Sanity UI](https://www.sanity.io/ui)
components to build a practical content-management workflow that goes beyond
single-document editing.

```tsx
<ThemeProvider theme={theme}>
  <Card padding={4} radius={3}>
    <Suspense fallback={<Text muted>Loading documents…</Text>}>
      <BulkDocumentEdit />
    </Suspense>
  </Card>
</ThemeProvider>

```

---

## How It Works

### Component Architecture

The example follows the App SDK's **one data-fetching hook per component** rule.
Each component that reads from the Content Lake is isolated behind its own
`<Suspense>` boundary so that slow-loading data never blocks the rest of the UI.

| Component | Hook(s) | Role |
|---|---|---|
| **`BulkDocumentEdit`** | `usePaginatedDocuments`, `useApplyDocumentActions` | Fetches a page of document handles, manages filters, selection, pagination, and bulk actions. `useApplyDocumentActions` is an _action_ hook — it doesn't trigger Suspense. |
| **`EditableRow`** | _(none)_ | Pure layout. Renders the checkbox, type badge, and delegates data-fetching to child components. |
| **`InlineTitle`** | `useDocument`, `useEditDocument` | Reads the current `title` value and writes changes back in real time. `useEditDocument` is an action hook, so this component only has one Suspense-triggering hook. |
| **`DocumentMeta`** | `useDocumentProjection` | Read-only projection of `_updatedAt`. Uses a projection instead of `useDocument` because we don't need to write back. |

### Paginated Document Fetching

```js
const {data, isPending, count, currentPage, totalPages, nextPage, previousPage, hasNextPage, hasPreviousPage} =
  usePaginatedDocuments({
    documentType: typeFilter || undefined,
    pageSize: 10,
    search: search || undefined,
    orderings: [{field: '_updatedAt', direction: 'desc'}],
  })
```

Unlike `useDocuments` (which uses infinite scroll with a `loadMore` callback),
`usePaginatedDocuments` gives you **page-based navigation**. This is a better fit
for tabular data where users need to jump between discrete pages rather than
continuously appending rows.

The hook returns:

- **`data`** — an array of document handles for the current page
- **`currentPage`** / **`totalPages`** — the current position in the result set
- **`nextPage()`** / **`previousPage()`** — functions to navigate between pages
- **`hasNextPage`** / **`hasPreviousPage`** — booleans to disable nav buttons at boundaries
- **`count`** — total matching documents across all pages
- **`isPending`** — `true` while a page transition is in progress

The `pageSize: 10` setting keeps each page manageable. Since each row loads its
own content via `useDocument` and `useDocumentProjection`, smaller pages mean
fewer concurrent data-fetching requests and faster initial render.

### Filtering by Document Type

```js
const [typeFilter, setTypeFilter] = useState('')

// passed to the hook:
documentType: typeFilter || undefined,
```

The `documentType` parameter tells the API to only return documents of a specific
type (e.g., `"article"`, `"product"`, `"author"`). When empty, all types are
returned. This filter runs server-side, so changing the type resets pagination to
page 1 and returns a fresh count.

The type filter uses a plain `TextInput` rather than a `Select` dropdown because
the available types depend on the project's schema — which this example doesn't
know ahead of time. In a real application, you could populate a dropdown by
querying for distinct `_type` values, or by reading the schema definition.

Combined with the `search` input, this gives two orthogonal filters:
- **Type** narrows the _kind_ of document (server-side, exact match)
- **Search** narrows by _content_ (server-side, full-text search)

Both parameters accept `undefined` to mean "no filter," which is why the hook
receives `typeFilter || undefined` instead of an empty string.

### Inline Editing with Real-Time Sync

```js
// Inside InlineTitle
const {data: title} = useDocument({...doc, path: 'title'})
const editTitle = useEditDocument({...doc, path: 'title'})
```

This is the core editing pattern in the App SDK. Instead of the traditional
"load → edit locally → save" cycle, every keystroke flows directly to the
Content Lake:

1. **`useDocument`** subscribes to the `title` path on a specific document and
   returns its current draft value. If another user (or another tab) edits the
   same field, this component re-renders automatically.

2. **`useEditDocument`** returns a setter function. Calling `editTitle("new value")`
   writes to the Content Lake immediately — no submit button needed. The SDK
   batches and debounces these writes internally.

Because the source of truth lives in the Content Lake (not in `useState`), there
is no stale-data problem. Two editors can type into the same field at the same
time and both will see a converged result.

> **Why no `useState`?** The SDK docs explicitly warn against using local state
> for form values that should sync with the Content Lake. If you store the title
> in `useState` and only write on submit, another user's changes would be
> silently overwritten.

### Bulk Selection

Selection state is managed with a plain `Set` in the parent component:

```js
const [selected, setSelected] = useState(new Set())

const toggleSelect = useCallback((id) => {
  setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}, [])
```

This is deliberately kept in local React state (not in the Content Lake) because
selection is a **UI concern** — it only matters to the current user in the current
session. The header checkbox toggles all visible rows on the current page at once.

Note that selection is **per-page**: navigating to another page doesn't
automatically clear your selections, but the "select all" checkbox only targets
rows on the visible page. In a production app you might want to track selections
across pages — the `Set` approach scales to this naturally since it stores
document IDs, not row indices.

### Bulk Actions: Publish and Unpublish

```js
const apply = useApplyDocumentActions()

const handleBulkPublish = useCallback(async () => {
  const docs = data.filter((d) => selected.has(d.documentId))
  await Promise.all(docs.map((d) => apply(publishDocument(d))))
  setSelected(new Set())
}, [data, selected, apply])
```

`useApplyDocumentActions` returns an `apply` function that accepts **document
actions** — `publishDocument`, `unpublishDocument`, and `deleteDocument`. Each
call targets a single document handle, so bulk operations use `Promise.all` to
run them in parallel.

After the actions complete, the selection is cleared. The documents in the table
update automatically because `useDocument` and `useDocumentProjection` are
real-time subscriptions — they reflect the new published/unpublished state
without any manual refetch.

### Suspense in Table Rows

Each row wraps its data-fetching children in separate `<Suspense>` boundaries:

```jsx
<td>
  <Suspense fallback={<TextInput value="Loading…" readOnly />}>
    <InlineTitle doc={doc} />
  </Suspense>
</td>
<td>
  <Suspense fallback={<Text muted>…</Text>}>
    <DocumentMeta doc={doc} />
  </Suspense>
</td>
```

This means the title and the timestamp load independently. If the title resolves
first, the user can start editing immediately while the timestamp is still
loading. Without separate boundaries, a single slow field would block the entire
row from rendering.

The fallbacks are designed to match the dimensions of the final content (a
read-only `TextInput` for the title column, a `Text` element for the timestamp)
to prevent layout shift when the real content loads in.

### Page Navigation

```jsx
<Flex gap={2} align="center" justify="center">
  <Button text="← Prev" disabled={!hasPreviousPage} onClick={previousPage} />
  <Text>Page {currentPage} of {totalPages}</Text>
  <Button text="Next →" disabled={!hasNextPage} onClick={nextPage} />
</Flex>
```

The pagination controls sit below the table. The `hasPreviousPage` and
`hasNextPage` booleans from `usePaginatedDocuments` disable the buttons at the
boundaries so users can't navigate past the first or last page.

When `isPending` is `true` (during a page transition), both buttons are also
disabled to prevent double-navigation. The table body drops to 60% opacity
during transitions to give a visual loading cue without replacing the existing
content with a spinner.

---

## Key Patterns

- **`usePaginatedDocuments` for tables** — page-based navigation fits tabular
  layouts better than infinite scroll. Use `useDocuments` when you want a
  continuous list; use `usePaginatedDocuments` when you need prev/next controls.
- **`documentType` for server-side filtering** — the type filter runs on the API,
  not in the browser. This keeps the page count accurate and avoids loading
  documents you'll immediately discard.
- **Handles first, content later** — `usePaginatedDocuments` fetches lightweight
  handles; `useDocument` and `useDocumentProjection` load content per-row on demand.
- **No local state for synced data** — `useEditDocument` writes directly to the
  Content Lake. Use `useState` only for UI-only concerns like selection and filters.
- **One fetching hook per component** — keeps Suspense boundaries granular and
  prevents unnecessary re-renders.
- **`Promise.all` for bulk actions** — `useApplyDocumentActions` operates on one
  document at a time, so parallelize with `Promise.all` for batch operations.
- **Sanity UI for layout** — `Card`, `Stack`, `Flex`, `TextInput`, `Checkbox`,
  `Button`, and `Badge` provide a consistent look without custom CSS.

```tsx
<Link to="/">← Back to home</Link>

```
