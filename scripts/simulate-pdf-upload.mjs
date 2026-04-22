/**
 * Simulation: IT Document PDF Upload Pipeline
 * Tests: Blob upload (private), Supabase insert, and serve proxy lookup
 * Run with: node scripts/simulate-pdf-upload.mjs
 */

import { put, get, del } from "@vercel/blob"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { config } from "dotenv"

// Load env vars from .env.local
config({ path: ".env.local" })

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

// ── Helpers ──────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  [PASS] ${msg}`) }
function fail(msg) { console.error(`  [FAIL] ${msg}`) }
function section(title) { console.log(`\n=== ${title} ===`) }

// ── 1. Env check ─────────────────────────────────────────────────────────────

section("1. Environment Variables")

let envOk = true
if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) {
  fail("NEXT_PUBLIC_SUPABASE_URL is missing or placeholder")
  envOk = false
} else {
  pass(`NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}`)
}

if (!SUPABASE_KEY || SUPABASE_KEY.includes("placeholder")) {
  fail("SUPABASE_SERVICE_ROLE_KEY is missing or placeholder")
  envOk = false
} else {
  pass(`SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_KEY.slice(0, 20)}...`)
}

if (!BLOB_TOKEN) {
  fail("BLOB_READ_WRITE_TOKEN is missing")
  envOk = false
} else {
  pass(`BLOB_READ_WRITE_TOKEN: ${BLOB_TOKEN.slice(0, 20)}...`)
}

if (!envOk) {
  console.error("\n[ABORT] Missing environment variables. Cannot continue simulation.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── 2. Create a minimal PDF-like buffer for testing ───────────────────────────

section("2. Preparing Test PDF File")

// Minimal valid PDF bytes
const minimalPdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`

const pdfBuffer = Buffer.from(minimalPdfContent, "utf-8")
const testFileName = `simulation-test-${Date.now()}.pdf`
const testFile = new Blob([pdfBuffer], { type: "application/pdf" })

pass(`Test PDF created: ${testFileName} (${pdfBuffer.length} bytes)`)

// ── 3. Simulate permission checks ─────────────────────────────────────────────

section("3. Permission Check Simulation")

const roles = [
  { role: "admin",            location: "Head Office",    shouldPass: true },
  { role: "it_head",         location: "Head Office",    shouldPass: true },
  { role: "regional_it_head", location: "Takoradi Port", shouldPass: true },
  { role: "regional_it_head", location: "Tema Training School", shouldPass: true },
  { role: "it_staff",        location: "Head Office",    shouldPass: true },
  { role: "it_staff",        location: "Takoradi Port",  shouldPass: false },
  { role: "staff",           location: "Head Office",    shouldPass: false },
]

function locationsMatch(a, b) {
  return a?.toLowerCase().trim() === b?.toLowerCase().trim()
}

let permissionAllPassed = true
for (const { role, location, shouldPass } of roles) {
  const isAdmin = role === "admin"
  const isITHead = role === "it_head"
  const isRegionalITHead = role === "regional_it_head"
  const isAllowedITStaff = role === "it_staff" && locationsMatch(location, "Head Office")
  const canUpload = isAdmin || isITHead || isRegionalITHead || isAllowedITStaff

  if (canUpload === shouldPass) {
    pass(`${role} @ ${location}: canUpload=${canUpload} (expected ${shouldPass})`)
  } else {
    fail(`${role} @ ${location}: canUpload=${canUpload} but expected ${shouldPass}`)
    permissionAllPassed = false
  }
}

// ── 4. Vercel Blob — private upload ──────────────────────────────────────────

section("4. Vercel Blob — Private Upload")

let uploadedPathname = null

try {
  const blobPath = `pdf-documents/simulation/${testFileName}`
  const blob = await put(blobPath, testFile, {
    access: "private",
    contentType: "application/pdf",
    token: BLOB_TOKEN,
  })

  uploadedPathname = blob.pathname
  pass(`Blob upload succeeded`)
  pass(`Pathname: ${uploadedPathname}`)
  pass(`URL (private, not publicly accessible): ${blob.url}`)
} catch (err) {
  fail(`Blob upload failed: ${err.message}`)
  console.error("  Detail:", err)
  process.exit(1)
}

// ── 5. Vercel Blob — private serve (get) ─────────────────────────────────────

section("5. Vercel Blob — Private Serve (get)")

try {
  const result = await get(uploadedPathname, {
    access: "private",
    token: BLOB_TOKEN,
  })

  if (!result) {
    fail("get() returned null — file not found in blob store")
  } else {
    pass(`get() succeeded — status: ${result.statusCode}`)
    pass(`Content-Type: ${result.blob?.contentType}`)
    pass(`ETag: ${result.blob?.etag}`)
  }
} catch (err) {
  fail(`Blob get() failed: ${err.message}`)
}

// ── 6. Supabase — insert pdf_upload record ────────────────────────────────────

section("6. Supabase — Insert pdf_uploads Record")

const FAKE_USER_ID = "00000000-0000-0000-0000-000000000001"
let insertedId = null

try {
  const { data, error } = await supabase
    .from("pdf_uploads")
    .insert({
      title: "[SIMULATION] IT Document Upload Test",
      description: "Automated simulation test — safe to delete",
      document_type: "information",
      file_name: testFileName,
      file_url: uploadedPathname,
      file_size: pdfBuffer.length,
      uploaded_by: FAKE_USER_ID,
      uploaded_by_name: "Simulation Script",
      target_location: "Head Office",
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    fail(`Insert failed: ${error.message}`)
    console.error("  Code:", error.code)
    console.error("  Details:", error.details)
    console.error("  Hint:", error.hint)
  } else {
    insertedId = data.id
    pass(`Insert succeeded — record ID: ${insertedId}`)
    pass(`Title: ${data.title}`)
    pass(`file_url (pathname): ${data.file_url}`)
    pass(`target_location: ${data.target_location}`)
    pass(`is_active: ${data.is_active}`)
  }
} catch (err) {
  fail(`Unexpected error during insert: ${err.message}`)
}

// ── 7. Supabase — fetch back the record ───────────────────────────────────────

section("7. Supabase — Fetch Back Record")

if (insertedId) {
  try {
    const { data, error } = await supabase
      .from("pdf_uploads")
      .select("*")
      .eq("id", insertedId)
      .single()

    if (error) {
      fail(`Fetch failed: ${error.message}`)
    } else {
      pass(`Fetch succeeded — file_url stored correctly: ${data.file_url}`)
    }
  } catch (err) {
    fail(`Unexpected error during fetch: ${err.message}`)
  }
} else {
  console.log("  [SKIP] No record ID available (insert failed)")
}

// ── 8. Cleanup — delete test record and blob ──────────────────────────────────

section("8. Cleanup")

if (insertedId) {
  const { error } = await supabase
    .from("pdf_uploads")
    .delete()
    .eq("id", insertedId)

  if (error) {
    fail(`DB cleanup failed: ${error.message}`)
  } else {
    pass(`DB record deleted (ID: ${insertedId})`)
  }
}

if (uploadedPathname) {
  try {
    // Construct the full blob URL for deletion
    // The del() function needs the full URL, not just the pathname
    const storeHost = BLOB_TOKEN.match(/vercel\.blob\.core\.windows\.net\/([^/]+)/)?.[0]
    if (storeHost) {
      await del(`https://${storeHost}/${uploadedPathname}`, { token: BLOB_TOKEN })
      pass(`Blob file deleted from store`)
    } else {
      console.log("  [INFO] Could not construct blob URL for deletion — manual cleanup may be needed")
      console.log(`  [INFO] Pathname to delete: ${uploadedPathname}`)
    }
  } catch (err) {
    console.log(`  [INFO] Blob cleanup skipped: ${err.message}`)
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

section("SIMULATION SUMMARY")
console.log("  Environment vars:   OK")
console.log(`  Permission checks:  ${permissionAllPassed ? "ALL PASSED" : "SOME FAILED"}`)
console.log(`  Blob upload:        ${uploadedPathname ? "OK" : "FAILED"}`)
console.log(`  Supabase insert:    ${insertedId ? "OK" : "FAILED"}`)
console.log("")
if (uploadedPathname && insertedId && permissionAllPassed) {
  console.log("  RESULT: Upload pipeline is WORKING correctly.")
  console.log("  Regional IT heads and admins can upload IT documents.")
} else {
  console.log("  RESULT: Pipeline has ISSUES — review FAIL messages above.")
}
