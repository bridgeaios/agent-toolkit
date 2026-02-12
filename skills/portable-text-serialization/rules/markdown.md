---
title: Serialize Portable Text to Markdown
description: Convert Portable Text to Markdown strings using @portabletext/markdown
tags: [portable-text, markdown, serialization, conversion]
---

# Serialize Portable Text to Markdown

Use `@portabletext/markdown` to convert PT blocks to Markdown strings. Useful for AI/LLM pipelines, static site generators, README generation, and anywhere Markdown is the target format.

```bash
npm install @portabletext/markdown
```

## Basic Usage

```ts
import {portableTextToMarkdown} from '@portabletext/markdown'

const markdown = portableTextToMarkdown(portableTextBlocks)
```

## Built-in Support

Out of the box, `portableTextToMarkdown` handles:

- Headings (h1–h6)
- Paragraphs
- Bold (`**`), italic (`_`), inline code (`` ` ``), strikethrough (`~~`)
- Links (`[text](url)`)
- Blockquotes (`>`)
- Ordered and unordered lists (including nested)
- Code blocks (fenced with language)
- Horizontal rules (`---`)
- Images (`![alt](url)`)
- Tables (GFM)

## Custom Renderers

Handle custom block types and marks with renderer functions:

```ts
const markdown = portableTextToMarkdown(blocks, {
  // Custom block types
  types: {
    callout: ({value}) => `> **${value.title}**\n> ${value.text}`,
    code: ({value}) => `\`\`\`${value.language || ''}\n${value.code}\n\`\`\``,
    image: ({value}) => `![${value.alt || ''}](${value.url})`,
  },

  // Custom block style renderers
  block: {
    h1: ({children}) => `# ${children}`,
    blockquote: ({children}) => `> ${children}`,
  },

  // Custom mark renderers
  marks: {
    highlight: ({children}) => `==${children}==`,
    internalLink: ({children, value}) => `[${children}](/docs/${value.slug})`,
  },

  // Custom list item renderer
  listItem: ({children}) => children,

  // Control spacing between blocks
  blockSpacing: '\n\n',

  // Handle unknown types gracefully
  unknownType: ({value}) => `<!-- Unknown type: ${value._type} -->`,
  unknownMark: ({children}) => children,
})
```

## Use Cases

| Use Case | Why Markdown |
|----------|-------------|
| AI/LLM context | Models work well with Markdown input |
| Static site generators | Hugo, Jekyll, Eleventy consume Markdown |
| README generation | Generate docs from Sanity content |
| Email (with converter) | Markdown → HTML for email templates |
| Export/backup | Human-readable content export |
| Documentation pipelines | Sanity as docs CMS, output as Markdown |

## Bidirectional: Also Converts Markdown → PT

The same package also provides `markdownToPortableText()` for the reverse direction. See the `portable-text-conversion` skill for details.

## Reference

- [@portabletext/markdown](https://github.com/portabletext/editor/tree/main/packages/markdown)
- Part of the [portabletext/editor](https://github.com/portabletext/editor) monorepo
