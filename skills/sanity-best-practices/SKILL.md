---
name: sanity-best-practices
description: Comprehensive Sanity development best practices covering integration guides (Next.js, Nuxt, Astro, Remix, SvelteKit, Hydrogen), GROQ performance, schema design, Visual Editing, images, Portable Text, page builders, Studio configuration, TypeGen, localization, and migrations. Use this skill when building, reviewing, or optimizing Sanity applications.
license: MIT
metadata:
  author: sanity
  version: "1.0.0"
---

# Sanity Best Practices

Comprehensive best practices and integration guides for Sanity development, maintained by Sanity. Contains 26 rules across 10 categories plus 21 integration and topic guides, prioritized by impact to guide schema design, query optimization, and frontend integration.

## When to Apply

Reference these guidelines when:
- Setting up a new Sanity project or onboarding
- Integrating Sanity with a frontend framework (Next.js, Nuxt, Astro, Remix, SvelteKit, Hydrogen)
- Writing GROQ queries or optimizing performance
- Designing content schemas
- Implementing Visual Editing and live preview
- Working with images, Portable Text, or page builders
- Configuring Sanity Studio structure
- Setting up TypeGen for type safety
- Implementing localization
- Migrating content from other systems
- Building custom apps with the Sanity App SDK
- Managing infrastructure with Blueprints

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | GROQ Performance | CRITICAL | `groq-` |
| 2 | Schema Design | HIGH | `schema-` |
| 3 | Visual Editing | HIGH | `visual-` |
| 4 | Images | HIGH | `image-` |
| 5 | Portable Text | HIGH | `pte-` |
| 6 | Page Builder | MEDIUM | `pagebuilder-` |
| 7 | Studio Configuration | MEDIUM | `studio-` |
| 8 | TypeGen | MEDIUM | `typegen-` |
| 9 | Localization | MEDIUM | `i18n-` |
| 10 | Migration | LOW-MEDIUM | `migration-` |

## Quick Reference

### Integration Guides

- `get-started` - Interactive onboarding for new Sanity projects
- `nextjs` - Next.js App Router, Live Content API, embedded Studio
- `nuxt` - Nuxt integration with @nuxtjs/sanity
- `astro` - Astro integration with @sanity/astro
- `remix` - React Router / Remix integration
- `svelte` - SvelteKit integration with @sanity/svelte-loader
- `hydrogen` - Shopify Hydrogen with Sanity
- `project-structure` - Monorepo and embedded Studio patterns
- `app-sdk` - Custom applications with Sanity App SDK
- `blueprints` - Infrastructure as Code with Sanity Blueprints

### Topic Guides

- `schema` - Schema design, field definitions, validation patterns
- `groq` - GROQ query patterns, type safety, performance
- `visual-editing` - Presentation Tool, Stega, overlays, live preview
- `page-builder` - Page Builder arrays, block components, live editing
- `portable-text` - Rich text rendering and custom components
- `image` - Image schema, URL builder, Next.js Image integration
- `studio-structure` - Desk structure, singletons, navigation
- `typegen` - TypeGen configuration, workflow, type utilities
- `seo` - Metadata, sitemaps, Open Graph, JSON-LD
- `localization` - i18n patterns and locale management
- `migration` - Content import from HTML, Markdown, other CMSs

### 1. GROQ Performance (CRITICAL)

- `groq-optimizable-filters` - Stack optimizable filters first for index usage
- `groq-avoid-joins-in-filters` - Use _ref instead of -> in filters
- `groq-project-fields` - Project only needed fields
- `groq-order-before-slice` - Apply order() before slice notation
- `groq-merge-references` - Combine repeated reference resolutions
- `groq-cursor-pagination` - Use cursor-based pagination for large datasets
- `groq-define-query` - Wrap queries in defineQuery for TypeGen

### 2. Schema Design (HIGH)

- `schema-define-helpers` - Use defineType, defineField, defineArrayMember
- `schema-data-over-presentation` - Model what things ARE, not what they look like
- `schema-reference-vs-object` - Choose references vs nested objects by reuse needs
- `schema-array-keys` - Use _key for array items, never index
- `schema-validation` - Patterns for email, URL, cross-field, and async validation
- `schema-deprecation-pattern` - Safe ReadOnly -> Hidden -> Deprecated lifecycle

### 3. Visual Editing (HIGH)

- `visual-editing-stega-clean` - Use stegaClean() before string comparisons
- `visual-editing-seo-metadata` - Never allow Stega in metadata/head tags
- `visual-editing-presentation-tool` - Configure Presentation Tool for overlays

### 4. Images (HIGH)

- `image-hotspot` - Enable hotspot:true for editor-controlled cropping
- `image-query-lqip` - Query asset->metadata.lqip for blur placeholders

### 5. Portable Text (HIGH)

- `pte-custom-components` - Define typed components for blocks, types, marks, lists

### 6. Page Builder (MEDIUM)

- `pagebuilder-block-previews` - Configure title, subtitle, and icon for blocks
- `pagebuilder-objects-vs-refs` - Default to objects; use references for shared content

### 7. Studio Configuration (MEDIUM)

- `studio-icons` - Assign icons from @sanity/icons to every type
- `studio-singleton-pattern` - Implement singletons via Structure, not schema options

### 8. TypeGen (MEDIUM)

- `typegen-workflow` - Extract + generate after schema or query changes

### 9. Localization (MEDIUM)

- `i18n-document-vs-field` - Document-level for presentation, field-level for data

### 10. Migration (LOW-MEDIUM)

- `migration-html-import` - Use @portabletext/block-tools with JSDOM for HTML import

## How to Use

Read individual reference files for detailed explanations and code examples:

```
references/groq-optimizable-filters.md
references/schema-data-over-presentation.md
references/nextjs.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

Each guide file contains:
- Comprehensive integration or topic coverage
- Decision matrices and workflow guidance
- Framework-specific patterns and examples

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
