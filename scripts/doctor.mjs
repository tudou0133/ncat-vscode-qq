#!/usr/bin/env node
import process from 'node:process';

const nodeVersion = process.versions.node;
const [major] = nodeVersion.split('.').map(Number);

console.log(`[doctor] Node.js version: ${nodeVersion}`);

if (Number.isNaN(major) || major < 20) {
  console.error('[doctor] Node.js >= 20 is required. Please upgrade Node.js first.');
  process.exit(1);
}

console.log('[doctor] Environment looks good for the NCat smoke test.');
