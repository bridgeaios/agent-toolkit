#!/usr/bin/env node

/**
 * Validates that all .mdc rule files have valid YAML frontmatter.
 * Run with: node scripts/validate-rules.mjs
 */

import {readdirSync, readFileSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'
import matter from 'gray-matter'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const rulesDir = join(rootDir, 'rules')

const files = readdirSync(rulesDir).filter((f) => f.endsWith('.mdc'))
let failed = false

for (const file of files) {
  const content = readFileSync(join(rulesDir, file), 'utf-8')
  try {
    const {data} = matter(content)
    if (!data.description) {
      console.error(`FAIL ${file}: missing 'description' in frontmatter`)
      failed = true
    } else {
      console.log(`  OK ${file}`)
    }
  } catch (e) {
    console.error(`FAIL ${file}: ${e.message.split('\n')[0]}`)
    failed = true
  }
}

if (failed) {
  console.error('\nValidation failed. Ensure all frontmatter values with special characters (*, :) are quoted.')
  process.exit(1)
} else {
  console.log(`\nAll ${files.length} rules validated successfully.`)
}
