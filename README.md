<p align="center">
  <a href="https://sanity.io">
    <img src="https://cdn.sanity.io/images/3do82whm/next/d6cf401d52c33b7a5a354a14ab7de94dea2f0c02-192x192.svg" />
  </a>
  <h1 align="center">Sanity Agent Toolkit</h1>
</p>

Collection of resources to help AI agents build better with [Sanity](https://www.sanity.io). Supports Cursor, Claude Code, VS Code, Lovable, v0, and any other editor/agent compatible with MCP, [Agent Skills](https://agentskills.io), or `.mdc` rules.

---

## Features

- **MCP server:** Direct access to your Sanity projects (content, datasets, releases, schemas) and agent rules.
- **Agent skills:** Comprehensive best practices skills for Sanity development, content modeling, SEO/AEO, and experimentation.
- **Agent rules:** 20+ portable `.mdc` files covering schema design, GROQ, Visual Editing, SEO, localization, migrations, and front-end framework integrations.
- **Claude Code plugin:** MCP server, agent skills, agent rules, and slash commands for [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) users.
- **Cursor plugin:** MCP server, agent skills, agent rules, and commands for the [Cursor Marketplace](https://cursor.com/marketplace).

---

## Get started

Choose your path based on how you want agents to work with Sanity:

1. **MCP server** — Give your agent always up-to-date rules and full access to your Sanity projects. No local files to maintain. Works with Cursor, VS Code, Claude Code, Lovable, v0, and other MCP-compatible clients.
2. **Agent skills** — Install best practices skills for Sanity, content modeling, SEO/AEO, and experimentation. Works with Cursor, Claude Code, and any [Agent Skills](https://agentskills.io)-compatible agent.
3. **Plugin** — Install the Sanity plugin for Cursor or Claude Code. Bundles MCP server, agent skills, agent rules, and commands.
4. **Manual installation** — Copy rules locally for offline use. You'll need to update them yourself.

### Option 1: Install MCP server (recommended)

Give agents direct access to Sanity projects and always up-to-date agent rules via the MCP server.

#### Quick install via Sanity CLI

Run in terminal to detect and configure MCP for Cursor, Claude Code and VS Code automatically:

```bash
npx sanity@latest mcp configure
```

Uses your logged-in CLI user for authentication — no manual tokens or OAuth needed.

#### Client-specific instructions

<details>
<summary><strong>Cursor</strong></summary>

One-click install:<br>
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=Sanity&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vbWNwLnNhbml0eS5pbyJ9)

Or manually: Open **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **View: Open MCP Settings** → **+ New MCP Server** → add to `mcp.json`:
```json
{
  "mcpServers": {
    "Sanity": {
      "type": "http",
      "url": "https://mcp.sanity.io"
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Code</strong></summary>

Run in terminal. Authenticate with OAuth on next launch:
```bash
claude mcp add Sanity -t http https://mcp.sanity.io --scope user
```
</details>

<details>
<summary><strong>VS Code</strong></summary>

Open **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **MCP: Open User Configuration** → add:
```json
{
  "servers": {
    "Sanity": {
      "type": "http",
      "url": "https://mcp.sanity.io"
    }
  }
}
```
</details>

<details>
<summary><strong>Lovable</strong></summary>

**Settings** → **Connectors** → **Personal connectors** → **New MCP server** → Enter `Sanity` as name and `https://mcp.sanity.io` as Server URL → **Add & authorize** → Authenticate with OAuth.
</details>

<details>
<summary><strong>v0</strong></summary>

In the prompt input field, click **Prompt Tools** → **MCPs** → **Add New** → Select **Sanity** → **Authorize** → Authenticate with OAuth.
</details>

<details>
<summary><strong>Replit</strong></summary>

Go to [Integrations Page](https://replit.com/integrations) → scroll to **MCP Servers for Replit Agent** → **Add MCP server** → Enter `Sanity` as name and `https://mcp.sanity.io` as Server URL → **Test & Save** → Authenticate with OAuth.
</details>

<details>
<summary><strong>OpenCode</strong></summary>

Add to your `opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sanity": {
      "type": "remote",
      "url": "https://mcp.sanity.io",
      "oauth": {}
    }
  }
}
```
Then run: `opencode mcp auth sanity`
</details>

<details>
<summary><strong>Other clients</strong></summary>

For any MCP-compatible client, add `https://mcp.sanity.io` as the server URL.

If your client doesn't support remote MCP servers, use a proxy like `mcp-remote`:
```json
{
  "mcpServers": {
    "Sanity": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.sanity.io", "--transport", "http-only"]
    }
  }
}
```
</details>

<br />

See the [Sanity MCP docs](https://www.sanity.io/docs/compute-and-ai/mcp-server) for authorization options and troubleshooting.

### Option 2: Install Agent Skills

Install best practices skills that work with any [Agent Skills](https://agentskills.io)-compatible agent.

```bash
npx skills add sanity-io/agent-toolkit
```

See [Option 3](#option-3-install-plugin) for plugin installation.

### Option 3: Install plugin

Install the Sanity plugin to get MCP server, agent skills, agent rules, and commands.

#### Claude Code

1. Add the Sanity marketplace:

```
/plugin marketplace add sanity-io/agent-toolkit
```

2. Install the plugin:

```
/plugin install sanity-plugin@sanity-agent-toolkit
```

3. Verify installation: Ask Claude Code: "which skills do you have access to?"

You should see the Sanity skills listed.

4. Start using: Use natural language and skills activate automatically:

> Use the sanity-scaffold skill to create a blog post schema

Or run `/sanity` to explore all capabilities.

#### Cursor

In Cursor chat, run:

```
/add-plugin sanity-plugin
```

### Option 4: Manual installation

Install the agent rules locally to teach your editor Sanity best practices:

1. Create a rules directory: `mkdir -p .cursor/rules`
2. Copy the contents of the `rules/` folder to your project's `.cursor/rules/` directory.
3. (Recommended) Copy `AGENTS.md` to your project root to act as a knowledge router.

---

## Capabilities

### MCP tools

With MCP connected, your AI can use tools like:
- `query_documents` — run GROQ queries directly
- `create_project` — create a new Sanity project
- `create_documents_from_markdown` — map markdown to Sanity documents
- `patch_document_from_json` — surgical edits to existing documents
- `transform_image` — edit images with AI
- `list_sanity_rules` / `get_sanity_rules` — load agent rules on demand

See the [full list of available tools](https://www.sanity.io/docs/compute-and-ai/mcp-server#k4ae680bb2e88).

### Agent skills

Best practices skills that agents like Claude Code, Cursor, GitHub Copilot, etc. can discover and use automatically. Skills follow the [Agent Skills](https://agentskills.io) format. See [Option 2](#option-2-install-agent-skills) for installation.

| Skill | Description |
| :--- | :--- |
| **sanity-best-practices** | GROQ performance, schema design, Visual Editing, images, Portable Text, Studio, TypeGen, localization, and migrations |
| **content-modeling-best-practices** | Structured content principles: separation of concerns, references vs embedding, content reuse |
| **seo-aeo-best-practices** | SEO/AEO with EEAT principles, structured data (JSON-LD), technical SEO patterns |
| **content-experimentation-best-practices** | A/B testing methodology, statistical foundations, experiment design |

### Getting started flow

The onboarding guide follows three phases:

1. **Studio & Schema** — Set up Sanity Studio and define your content model
2. **Content** — Import existing content or generate placeholder content via MCP
3. **Frontend** — Integrate with your application (framework-specific)

Just say: "Get started with Sanity" to begin.

### Agent rules

Portable `.mdc` files that provide Sanity best practices to AI agents.

<details>
<summary><strong>Core fundamentals</strong></summary>

- **`sanity-schema.mdc`**: The "Data > Presentation" philosophy, `defineType` syntax, and shared fields.
- **`sanity-groq.mdc`**: Performance rules, fragment reuse, and the "Golden Rule" of projections.
- **`sanity-visual-editing.mdc`**: Implementation of Content Source Maps (Stega) and Presentation Tool.
- **`sanity-typegen.mdc`**: TypeScript type generation from schema.
- **`sanity-project-structure.mdc`**: File organization for Studio and monorepos.
- **`sanity-get-started.mdc`**: Interactive 3-phase onboarding guide.
- **`sanity-app-sdk.mdc`**: Building custom apps with the Sanity App SDK, React hooks, and real-time patterns.
</details>

<details>
<summary><strong>Framework rules</strong></summary>

- **`sanity-nextjs.mdc`**: App Router, `defineLive`, and metadata handling.
- **`sanity-remix.mdc`**: React Router loaders and data fetching patterns.
- **`sanity-svelte.mdc`**: SvelteKit hooks and loaders.
- **`sanity-nuxt.mdc`**: Nuxt modules and `useSanityQuery`.
- **`sanity-astro.mdc`**: Astro content collections and islands.
- **`sanity-hydrogen.mdc`**: Shopify Hydrogen and Sanity Connect.
</details>

<details>
<summary><strong>Best practices</strong></summary>

- **`sanity-migration.mdc`**: Strategies for importing HTML/Markdown from legacy CMSs.
- **`sanity-image.mdc`**: Hotspots, LQIP, and the `urlFor` builder.
- **`sanity-studio-structure.mdc`**: Organizing the Studio sidebar (singletons, groupings).
- **`sanity-portable-text.mdc`**: Rendering rich text with custom components.
- **`sanity-page-builder.mdc`**: Page builder patterns and block component rendering.
- **`sanity-localization.mdc`**: Internationalization patterns.
- **`sanity-seo.mdc`**: Metadata, sitemaps, and Open Graph.
</details>

### Slash commands (Claude Code)

| Command | What it does |
| :--- | :--- |
| `/sanity` | List available skills and help topics |
| `/review` | Review code for Sanity best practices |
| `/typegen` | Run TypeGen and troubleshoot issues |
| `/deploy-schema` | Deploy schema with verification |

---

## Repository structure

```text
sanity-io/agent-toolkit/
├── AGENTS.md                      # Knowledge router & agent behavior
├── README.md                      # This file
├── .claude-plugin/                # Claude Code plugin configuration
│   └── marketplace.json           # Plugin metadata and marketplace config
├── .cursor-plugin/                # Cursor plugin configuration
│   ├── marketplace.json           # Cursor marketplace metadata
│   └── plugin.json                # Per-plugin manifest
├── .mcp.json                      # MCP server configuration
├── assets/                        # Plugin branding
│   └── logo.svg                   # Sanity logo for marketplace display
├── commands/                      # Agent commands
│   ├── sanity.md                  # /sanity help
│   ├── review.md                  # /review
│   ├── typegen.md                 # /typegen
│   └── deploy-schema.md           # /deploy-schema
├── rules/                         # Agent rules (.mdc)
│   ├── sanity-schema.mdc          # Schema design patterns
│   ├── sanity-groq.mdc            # GROQ query patterns
│   ├── sanity-nextjs.mdc          # Next.js integration
│   └── ...                        # Additional framework rules
├── scripts/                       # Validation and CI scripts
│   └── validate-cursor-plugin.mjs # Cursor plugin validator
└── skills/                        # Agent skills (agentskills.io format)
    ├── sanity-best-practices/     # Comprehensive Sanity skill
    │   ├── SKILL.md
    │   └── rules/                 # Individual rule files
    ├── content-modeling-best-practices/
    ├── seo-aeo-best-practices/
    └── content-experimentation-best-practices/
```

---

## Resources

- [Create Sanity account](https://www.sanity.io/get-started)
- [Sanity documentation](https://www.sanity.io/docs)
- [GROQ language reference](https://www.sanity.io/docs/groq)
- [Visual Editing guide](https://www.sanity.io/docs/visual-editing)
- [Sanity TypeGen](https://www.sanity.io/docs/sanity-typegen)
- [MCP server docs](https://www.sanity.io/docs/compute-and-ai/mcp-server)


---

## Contributing

Found a better pattern? Missing a framework or best practice?

1. Fork the repo.
2. Update the relevant file:
   - **Rules:** Edit `.mdc` files in `rules/`
   - **Skills:** Edit rule files in `skills/<skill-name>/rules/`
3. Run `npm run validate:all` to check skill validity and Cursor plugin structure.
4. Submit a PR.

---

## Support

- [Sanity Community (Discord)](https://www.sanity.io/community/join)
- [GitHub issues](https://github.com/sanity-io/agent-toolkit/issues)

---

**License:** MIT
