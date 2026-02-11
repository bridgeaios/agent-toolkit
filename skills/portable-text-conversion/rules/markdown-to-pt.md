---
title: Convert Markdown to Portable Text
description: Convert Markdown content into Portable Text blocks via HTML intermediate or direct construction
tags: [portable-text, markdown, conversion, migration, import]
---

# Convert Markdown to Portable Text

There is no direct Markdown-to-PT library. Two approaches:

1. **Markdown → HTML → PT** (recommended for most cases)
2. **Markdown → AST → PT** (for precise control)

## Approach 1: Markdown → HTML → PT

Convert Markdown to HTML first, then use `htmlToBlocks`:

```bash
npm install @portabletext/block-tools jsdom marked
```

```ts
import {marked} from 'marked'
import {JSDOM} from 'jsdom'
import {htmlToBlocks} from '@portabletext/block-tools'

function markdownToPortableText(markdown: string, blockContentType) {
  // Step 1: Markdown → HTML
  const html = marked.parse(markdown, {gfm: true})

  // Step 2: HTML → Portable Text
  const blocks = htmlToBlocks(html, blockContentType, {
    parseHtml: (html) => new JSDOM(html).window.document,
  })

  return blocks
}
```

### Handle Code Blocks

Markdown fenced code blocks become `<pre><code>` in HTML. Add a custom deserializer:

```ts
const blocks = htmlToBlocks(html, blockContentType, {
  parseHtml: (html) => new JSDOM(html).window.document,
  rules: [
    {
      deserialize(el, next, block) {
        if (
          el.tagName?.toLowerCase() === 'pre' &&
          el.children?.[0]?.tagName?.toLowerCase() === 'code'
        ) {
          const codeEl = el.children[0]
          const language = codeEl.className?.replace('language-', '') || 'text'

          return block({
            _type: 'code',
            language,
            code: codeEl.textContent || '',
          })
        }
        return undefined
      },
    },
    // Handle inline images from markdown ![alt](url)
    {
      deserialize(el, next, block) {
        if (el.tagName?.toLowerCase() !== 'img') return undefined
        return block({
          _type: 'image',
          alt: el.getAttribute('alt') || '',
          _sanityAsset: `image@${el.getAttribute('src')}`,
        })
      },
    },
  ],
})
```

## Approach 2: Markdown → AST → PT (Advanced)

For precise control, parse Markdown to an AST and build PT blocks directly:

```bash
npm install unified remark-parse
```

```ts
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import {randomKey} from '@sanity/util/content'

function markdownAstToPortableText(markdown: string) {
  const tree = unified().use(remarkParse).parse(markdown)
  return convertNodes(tree.children)
}

function convertNodes(nodes) {
  const blocks = []

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        blocks.push({
          _type: 'block',
          _key: randomKey(12),
          style: 'normal',
          children: convertInline(node.children),
          markDefs: collectMarkDefs(node.children),
        })
        break

      case 'heading':
        blocks.push({
          _type: 'block',
          _key: randomKey(12),
          style: `h${node.depth}`,
          children: convertInline(node.children),
          markDefs: collectMarkDefs(node.children),
        })
        break

      case 'blockquote':
        // Flatten blockquote children into blocks with blockquote style
        for (const child of node.children) {
          if (child.type === 'paragraph') {
            blocks.push({
              _type: 'block',
              _key: randomKey(12),
              style: 'blockquote',
              children: convertInline(child.children),
              markDefs: collectMarkDefs(child.children),
            })
          }
        }
        break

      case 'list':
        blocks.push(...convertList(node))
        break

      case 'code':
        blocks.push({
          _type: 'code',
          _key: randomKey(12),
          language: node.lang || 'text',
          code: node.value,
        })
        break

      case 'thematicBreak':
        blocks.push({_type: 'break', _key: randomKey(12), style: 'lineBreak'})
        break
    }
  }

  return blocks
}

function convertInline(nodes, marks = []) {
  const spans = []

  for (const node of nodes || []) {
    switch (node.type) {
      case 'text':
        spans.push({
          _type: 'span',
          _key: randomKey(12),
          text: node.value,
          marks: [...marks],
        })
        break

      case 'strong':
        spans.push(...convertInline(node.children, [...marks, 'strong']))
        break

      case 'emphasis':
        spans.push(...convertInline(node.children, [...marks, 'em']))
        break

      case 'inlineCode':
        spans.push({
          _type: 'span',
          _key: randomKey(12),
          text: node.value,
          marks: [...marks, 'code'],
        })
        break

      case 'link': {
        const key = randomKey(12)
        spans.push(...convertInline(node.children, [...marks, key]))
        // markDef collected separately via collectMarkDefs
        break
      }
    }
  }

  return spans
}

function convertList(node, level = 1) {
  const listType = node.ordered ? 'number' : 'bullet'
  const blocks = []

  for (const item of node.children) {
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        blocks.push({
          _type: 'block',
          _key: randomKey(12),
          style: 'normal',
          listItem: listType,
          level,
          children: convertInline(child.children),
          markDefs: collectMarkDefs(child.children),
        })
      } else if (child.type === 'list') {
        blocks.push(...convertList(child, level + 1))
      }
    }
  }

  return blocks
}
```

## When to Use Which Approach

| Scenario | Approach |
|----------|----------|
| Simple migration, standard Markdown | Markdown → HTML → PT |
| GFM tables, footnotes, custom syntax | Markdown → AST → PT |
| Need custom block types (code, embeds) | Either, with custom rules/handlers |
| Bulk import from CMS | Markdown → HTML → PT (simpler) |
| Real-time conversion in app | Markdown → AST → PT (no DOM needed) |

## Reference

- [marked](https://github.com/markedjs/marked)
- [unified/remark](https://github.com/remarkjs/remark)
- [@portabletext/block-tools](https://www.portabletext.org)
