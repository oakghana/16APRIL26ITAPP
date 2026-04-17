#!/usr/bin/env node

/**
 * Fix script to update all API routes that initialize Supabase with non-null assertions
 * This prevents build errors when environment variables are not available during build time
 */

const fs = require('fs')
const path = require('path')

const routesToFix = [
  'app/api/admin/delete-data/route.ts',
  'app/api/admin/department-heads/route.ts',
  'app/api/admin/backup-database/route.ts',
  'app/api/admin/restore-database/route.ts',
  'app/api/admin/reset-passwords-now/route.ts',
  'app/api/admin/force-reset-password/route.ts',
  'app/api/admin/link-department-staff/route.ts',
  'app/api/admin/service-providers/route.ts',
  'app/api/admin/set-user-password/route.ts',
  'app/api/admin/set-password-for-user/route.ts',
  'app/api/admin/setup-admin/route.ts',
  'app/api/admin/simulate-login/route.ts',
  'app/api/admin/lookup-data/route.ts',
  'app/api/admin/test-password/route.ts',
  'app/api/admin/reset-all-passwords-ghana/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/change-password/route.ts',
  'app/api/dashboard/badge-counts/route.ts',
  'app/api/repairs/update/route.ts',
  'app/api/service-tickets/update/route.ts',
  'app/api/store/transfer-item/route.ts',
]

console.log('Supabase Initialization Fix Script')
console.log('===================================')
console.log(`Routes to fix: ${routesToFix.length}`)
console.log('')
console.log('This script requires manual updates to each route.')
console.log('Pattern to replace:')
console.log('  OLD: const supabaseAdmin = createClient(')
console.log('         process.env.NEXT_PUBLIC_SUPABASE_URL!,')
console.log('         process.env.SUPABASE_SERVICE_ROLE_KEY!')
console.log('       )')
console.log('')
console.log('  NEW: import { getServerSupabase } from "@/lib/supabase"')
console.log('       ... (in function body)')
console.log('       const supabaseAdmin = getServerSupabase()')
console.log('')
console.log('Files to update manually:')
routesToFix.forEach(route => {
  console.log(`  - ${route}`)
})
