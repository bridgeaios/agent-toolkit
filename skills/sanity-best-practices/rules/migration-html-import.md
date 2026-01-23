---
title: Import HTML to Portable Text
description: Use @portabletext/block-tools with JSDOM to convert HTML content
tags: migration, html, portable-text, import
---

## Import HTML to Portable Text

Use `@portabletext/block-tools` with `JSDOM` to convert HTML from legacy CMSs to Portable Text.

### Setup

```bash
npm install @portabletext/block-tools jsdom
```

### Basic Conversion

```javascript
const { htmlToBlocks } = require('@portabletext/block-tools')
const { JSDOM } = require('jsdom')

// Get block content type from your schema
const blockContentType = schema.get('blockContent')

const blocks = htmlToBlocks(htmlString, blockContentType, {
  parseHtml: html => new JSDOM(html).window.document,
})
```

### Custom Deserializers

Handle specific HTML patterns:

```javascript
const blocks = htmlToBlocks(htmlString, blockContentType, {
  parseHtml: html => new JSDOM(html).window.document,
  rules: [
    {
      deserialize(el, next, block) {
        // Custom link handling
        if (el.tagName.toLowerCase() === 'a') {
          return {
            _type: 'link',
            href: el.getAttribute('href'),
            blank: el.getAttribute('target') === '_blank'
          }
        }
        // Custom image handling
        if (el.tagName.toLowerCase() === 'img') {
          return {
            _type: 'image',
            // Upload image separately, store reference
            _sanityAsset: `image@${el.getAttribute('src')}`
          }
        }
        return undefined  // Fall through to default handling
      }
    }
  ]
})
```

### Pre-Processing HTML

Clean HTML before conversion:

```javascript
function cleanHtml(html) {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  
  // Remove layout elements
  doc.querySelectorAll('header, footer, nav, .sidebar').forEach(el => el.remove())
  
  // Extract metadata before processing body
  const title = doc.querySelector('title')?.textContent
  const description = doc.querySelector('meta[name="description"]')?.content
  
  return {
    body: doc.body.innerHTML,
    metadata: { title, description }
  }
}
```

### Image Upload

Don't just link external images—upload them:

```javascript
async function uploadImage(client, imageUrl) {
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()
  
  const asset = await client.assets.upload('image', Buffer.from(buffer), {
    filename: imageUrl.split('/').pop()
  })
  
  return {
    _type: 'image',
    asset: { _type: 'reference', _ref: asset._id }
  }
}
```

Reference: [Content Migration Cheatsheet](https://www.sanity.io/docs/content-lake/content-migration-cheatsheet)
