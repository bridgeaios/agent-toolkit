---
title: "Document List"
description: "Interactive example showing how to fetch and display a list of documents using useDocuments (infinite scroll with load more) and useDocumentProjection (lazy per-row field rendering with viewport detection). Includes a search input for filtering results."
---

```tsx
import {
  useDocuments,
  useDocumentProjection,
} from '@sanity/sdk-react'
import {Suspense, useRef, useState} from 'react'
import {Link} from 'react-router'

export function DocumentRow({doc}) {
  const ref = useRef(null)
  const {data} = useDocumentProjection({
    ...doc,
    ref,
    projection: '{title, _updatedAt}',
  })

  return (
    <li ref={ref} style={{padding: '0.5rem 0', borderBottom: '1px solid #eee'}}>
      <strong>{data?.title || 'Untitled'}</strong>
      <br />
      <small style={{color: '#666'}}>
        {doc.documentType}
        {data?._updatedAt && ` · ${new Date(data._updatedAt).toLocaleDateString()}`}
      </small>
    </li>
  )
}

export function DocumentList() {
  const [search, setSearch] = useState('')
  const {data, hasMore, isPending, loadMore, count} = useDocuments({
    batchSize: 10,
    search: search || undefined,
    orderings: [{field: '_updatedAt', direction: 'desc'}],
  })

  return (
    <div>
      <input
        type="search"
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '0.5rem',
          marginBottom: '1rem',
          fontSize: '1rem',
          border: '1px solid #ccc',
          borderRadius: 4,
          boxSizing: 'border-box',
        }}
      />

      <p style={{color: '#666', fontSize: '0.875rem'}}>
        {count} document{count !== 1 ? 's' : ''} found
      </p>

      <ul style={{listStyle: 'none', padding: 0, margin: 0, opacity: isPending ? 0.6 : 1}}>
        {data.map((doc) => (
          <Suspense key={doc.documentId} fallback={<li style={{padding: '0.5rem 0'}}>Loading…</li>}>
            <DocumentRow doc={doc} />
          </Suspense>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isPending}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: isPending ? 'wait' : 'pointer',
          }}
        >
          {isPending ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

# Document List

Demonstrates using `useDocuments` to fetch a list of documents with infinite scrolling
and `useDocumentProjection` to efficiently render each document's fields.

```tsx
<Suspense fallback={<p>Loading documents…</p>}>
  <DocumentList />
</Suspense>

<Link to="/">← Back to home</Link>

```
