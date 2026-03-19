#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const examplesDir = path.join(
  repoRoot,
  "apps",
  "sdk-examples",
  "src",
  "routes",
  "examples"
);
const skillDir = path.join(repoRoot, "skills", "sdk-app");
const resourcesDir = path.join(skillDir, "resources");
const bestPracticesDir = path.join(repoRoot, "skills", "sanity-best-practices");
const bestPracticesResourcesDir = path.join(bestPracticesDir, "resources");

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { fields: {}, body: normalized };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return { fields: {}, body: normalized };
  }

  const frontmatterBlock = normalized.slice(4, closingIndex);
  const fields = {};

  for (const line of frontmatterBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }

  const body = normalized.slice(closingIndex + 5);
  return { fields, body };
}

function mdxToMarkdown(body) {
  const lines = body.split("\n");
  const output = [];

  // Phase 1: Identify the code preamble (imports + component definitions)
  // This is everything before the first markdown heading or plain prose line
  const codeLines = [];
  let bodyStart = 0;

  // Collect all imports first (may be multi-line)
  let i = 0;
  // Skip leading blank lines
  while (i < lines.length && lines[i].trim() === "") i++;

  // Collect import block
  let inImport = false;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("import ")) {
      inImport = true;
      codeLines.push(line);
      // Check if import is complete (has 'from' on this line)
      if (line.includes(" from ")) {
        inImport = false;
      }
      i++;
      continue;
    }
    if (inImport) {
      codeLines.push(line);
      if (line.includes(" from ") || line.match(/}\s*from\s/)) {
        inImport = false;
      }
      i++;
      continue;
    }
    break;
  }

  // Skip blank lines between imports and components
  while (i < lines.length && lines[i].trim() === "") i++;

  // Collect exported component definitions
  let braceDepth = 0;
  let inComponent = false;
  while (i < lines.length) {
    const line = lines[i];

    if (
      !inComponent &&
      (line.startsWith("export function ") ||
        line.startsWith("export default function "))
    ) {
      if (codeLines.length > 0 && codeLines[codeLines.length - 1] !== "") {
        codeLines.push("");
      }
      inComponent = true;
      braceDepth = 0;
    }

    if (inComponent) {
      codeLines.push(line);
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
      if (braceDepth === 0 && line.includes("}")) {
        inComponent = false;
        i++;
        // Skip blank lines between components
        while (i < lines.length && lines[i].trim() === "") i++;
        continue;
      }
      i++;
      continue;
    }

    break;
  }

  bodyStart = i;

  // Emit the code preamble as a single fenced block
  if (codeLines.length > 0) {
    output.push("```tsx");
    output.push(...codeLines);
    output.push("```");
    output.push("");
  }

  // Phase 2: Process the remaining body (markdown + inline JSX)
  let inCodeBlock = false;
  let jsxBuffer = [];
  let collectingJsx = false;

  for (let j = bodyStart; j < lines.length; j++) {
    const line = lines[j];

    // Track fenced code blocks
    if (line.startsWith("```")) {
      if (collectingJsx) {
        output.push("```tsx");
        output.push(...jsxBuffer);
        output.push("```");
        output.push("");
        jsxBuffer = [];
        collectingJsx = false;
      }
      inCodeBlock = !inCodeBlock;
      output.push(line);
      continue;
    }

    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    // Detect JSX lines (starts with < followed by uppercase, or closing tags, or is indented JSX)
    const isJsxLine =
      line.match(/^\s*<[A-Z]/) ||
      line.match(/^\s*<\/[A-Z]/) ||
      line.match(/^\s*<[a-z].*\/>$/);

    if (isJsxLine) {
      if (!collectingJsx) {
        collectingJsx = true;
        jsxBuffer = [];
      }
      jsxBuffer.push(line);
      continue;
    }

    // If we were collecting JSX and hit a non-JSX, non-blank line
    if (collectingJsx) {
      // Indented continuation lines are still JSX
      if (line.match(/^\s+\S/) || line.trim() === "") {
        jsxBuffer.push(line);
        continue;
      }
      output.push("```tsx");
      output.push(...jsxBuffer);
      output.push("```");
      output.push("");
      jsxBuffer = [];
      collectingJsx = false;
    }

    output.push(line);
  }

  // Flush remaining JSX buffer
  if (collectingJsx && jsxBuffer.length > 0) {
    output.push("```tsx");
    output.push(...jsxBuffer);
    output.push("```");
  }

  return output.join("\n").trim();
}

async function findMdxFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findMdxFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function slugFromPath(filePath) {
  const relative = path.relative(examplesDir, filePath);
  return relative.replace(/\.mdx$/, "").replace(/\\/g, "/");
}

async function main() {
  // Find all MDX files
  let mdxFiles;
  try {
    mdxFiles = await findMdxFiles(examplesDir);
  } catch (err) {
    console.error(`Failed to read examples directory: ${examplesDir}`);
    console.error(err.message);
    process.exit(1);
  }

  if (mdxFiles.length === 0) {
    console.log("No MDX files found in", examplesDir);
    process.exit(0);
  }

  console.log(`Found ${mdxFiles.length} MDX file(s)`);

  // Ensure output directories exist
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.mkdir(bestPracticesResourcesDir, { recursive: true });

  // Process each MDX file into a resource
  const resources = [];

  for (const mdxPath of mdxFiles) {
    const slug = slugFromPath(mdxPath);
    const raw = await fs.readFile(mdxPath, "utf8");
    const { fields, body } = parseFrontmatter(raw);

    const title = fields.title || slug;
    const description =
      fields.description || `SDK example: ${slug}`;

    // Convert MDX body to markdown with code blocks
    const markdownBody = mdxToMarkdown(body);

    const resourceContent = [
      "---",
      `title: "${title}"`,
      `description: "${description}"`,
      "---",
      "",
      markdownBody,
      "",
    ].join("\n");

    const outFileName = `${slug.replace(/\//g, "-")}.md`;
    const outPath = path.join(resourcesDir, outFileName);
    await fs.writeFile(outPath, resourceContent, "utf8");
    console.log(`  ${path.relative(repoRoot, mdxPath)} → skills/sdk-app/resources/${outFileName}`);

    // Also write to sanity-best-practices/resources/ with app-sdk-example- prefix
    const bpFileName = `app-sdk-example-${slug.replace(/\//g, "-")}.md`;
    const bpOutPath = path.join(bestPracticesResourcesDir, bpFileName);
    await fs.writeFile(bpOutPath, resourceContent, "utf8");
    console.log(`  ${path.relative(repoRoot, mdxPath)} → skills/sanity-best-practices/resources/${bpFileName}`);

    resources.push({ slug, title, description, fileName: outFileName, bpFileName });
  }

  // Generate SKILL.md
  const resourceList = resources
    .map((r) => `- \`resources/${r.fileName}\` — ${r.description}`)
    .join("\n");

  const skillMd = [
    "---",
    "name: sdk-app",
    "description: Working code examples for the Sanity App SDK demonstrating React hooks, document listing, real-time projections, search, and infinite scrolling. Use this skill when building or reviewing Sanity App SDK applications and you need concrete, runnable examples of SDK patterns.",
    "---",
    "",
    "# Sanity App SDK Examples",
    "",
    "Runnable code examples extracted from the SDK examples app, demonstrating real-world usage of `@sanity/sdk-react` hooks and patterns.",
    "",
    "## When to Apply",
    "",
    "Reference these examples when:",
    "- Building a new Sanity App SDK application",
    "- Implementing document listing, search, or pagination",
    "- Using `useDocuments` or `useDocumentProjection` hooks",
    "- Setting up React Suspense boundaries with Sanity SDK",
    "- Reviewing App SDK code for correctness",
    "",
    "## Resources",
    "",
    "Start with the example that matches the pattern you need:",
    resourceList,
    "",
    "## How to Use",
    "",
    "Each resource contains a complete, working code example with inline explanation. Load the resource that matches your use case:",
    "",
    "```",
    resources.map((r) => `resources/${r.fileName}`).join("\n"),
    "```",
    "",
  ].join("\n");

  await fs.writeFile(path.join(skillDir, "SKILL.md"), skillMd, "utf8");
  console.log(`\nGenerated skills/sdk-app/SKILL.md with ${resources.length} resource(s)`);

  // Update app-sdk.md in sanity-best-practices to reference the examples
  const appSdkPath = path.join(bestPracticesDir, "references", "app-sdk.md");
  let appSdkContent = await fs.readFile(appSdkPath, "utf8");

  // Build the examples section
  const examplesList = resources
    .map((r) => `- \`resources/${r.bpFileName}\` — ${r.title}: ${r.description}`)
    .join("\n");

  const examplesSection = [
    "",
    "## Working Examples",
    "",
    "Complete, runnable code examples extracted from the SDK examples app. Load a specific example for full implementation details:",
    "",
    examplesList,
    "",
  ].join("\n");

  // Insert or replace the examples section
  const examplesMarker = "## Working Examples";
  const markerIndex = appSdkContent.indexOf(examplesMarker);
  if (markerIndex !== -1) {
    // Find the next ## heading after the marker (or end of file)
    const afterMarker = appSdkContent.indexOf("\n## ", markerIndex + examplesMarker.length);
    if (afterMarker !== -1) {
      appSdkContent =
        appSdkContent.slice(0, markerIndex) +
        examplesSection.trimStart() +
        appSdkContent.slice(afterMarker);
    } else {
      appSdkContent = appSdkContent.slice(0, markerIndex) + examplesSection.trimStart();
    }
  } else {
    // Append before the last --- or at the end
    appSdkContent = appSdkContent.trimEnd() + "\n" + examplesSection;
  }

  await fs.writeFile(appSdkPath, appSdkContent, "utf8");
  console.log(`Updated skills/sanity-best-practices/references/app-sdk.md with ${resources.length} example(s)`);

  // Validate using skills-ref
  console.log("\nValidating skills...");
  const { execSync } = await import("node:child_process");
  const skillsToValidate = [skillDir, bestPracticesDir];
  for (const dir of skillsToValidate) {
    try {
      const result = execSync(`pnpm exec skills-ref validate ${dir}`, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
      console.log(result.trim());
    } catch (err) {
      console.error("Validation failed:");
      console.error(err.stdout || err.stderr || err.message);
      process.exit(1);
    }
  }
}

await main();
