#!/usr/bin/env node

/**
 * Batch fix script to replace createClient initialization with getServerSupabase()
 * Run this script in the project root: node scripts/batch-fix-supabase.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const API_ROUTES_DIR = path.join(projectRoot, 'app/api');

// Pattern to match module-level Supabase initialization
const INIT_PATTERNS = [
  {
    regex: /import\s*{\s*createClient\s*}\s*from\s*["']@supabase\/supabase-js["']/,
    replacement: "import { getServerSupabase } from \"@/lib/supabase\""
  }
];

const SUPABASE_INIT_PATTERNS = [
  {
    // const supabaseAdmin = createClient(process.env.X!, process.env.Y!)
    regex: /const\s+(\w+)\s*=\s*createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*\)/g,
    replacement: (match, varName) => ''
  },
  {
    // const supabase = createClient(...) with multi-line
    regex: /const\s+(\w+)\s*=\s*createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY![\s\S]*?\)/g,
    replacement: ''
  }
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // Skip files that already have getServerSupabase
    if (content.includes('getServerSupabase')) {
      console.log(`✓ Already fixed: ${path.relative(projectRoot, filePath)}`);
      return;
    }

    // Skip files that don't have createClient
    if (!content.includes('createClient(process.env.NEXT_PUBLIC_SUPABASE_URL')) {
      return;
    }

    // Replace import
    if (content.includes('import { createClient }')) {
      content = content.replace(
        /import\s*{\s*createClient\s*}\s*from\s*["']@supabase\/supabase-js["']/,
        'import { getServerSupabase } from "@/lib/supabase"'
      );
    }

    // Remove module-level Supabase initialization
    content = content.replace(
      /\/\/\s*Use\s+service\s+role\s+key.*?\n\s*const\s+\w+\s*=\s*createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*\)\s*\n/g,
      ''
    );

    content = content.replace(
      /const\s+(\w+)\s*=\s*createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*\)\s*\n/g,
      ''
    );

    // Handle multi-line initialization
    content = content.replace(
      /const\s+(\w+)\s*=\s*createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY![\s\S]*?\)\s*\n/g,
      ''
    );

    // Add getServerSupabase() call in first async function
    if (content.includes('export async function')) {
      content = content.replace(
        /(export async function \w+\([^)]*\)\s*{\s*try\s*{)/,
        (match) => {
          if (!match.includes('getServerSupabase()')) {
            return match + '\n    const supabaseAdmin = getServerSupabase() || const supabase = getServerSupabase()';
          }
          return match;
        }
      );
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Fixed: ${path.relative(projectRoot, filePath)}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('route.ts')) {
      processFile(filePath);
    }
  }
}

console.log('Starting batch fix of Supabase initialization...\n');
walkDir(API_ROUTES_DIR);
console.log('\nBatch fix complete!');
