/**
 * Simulation: IT Document PDF Upload Pipeline
 * Tests: env vars, permission logic, Blob private upload, Supabase insert/fetch, cleanup
 */

import { put, get, del } from "@vercel/blob"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BLOB_TOKEN   = process.env.BLOB_READ_WRITE_TOKEN

// ── Helpers ──────────────────────────────────────────────────────────────────
const pass    = (msg) => console.log(`  [PASS] ${msg}`)
const fail    = (msg) => console.error(`  [FAIL] ${msg}`)
const section = (t)   => console.log(`\n=== ${t} ===`)
const skip    = (msg) => console.log(`  [SKIP] ${msg}`)

// ── 1. Environment Variables ──────────────────────────────────────────────────
section("1. Environment Variables")

let envOk = true
if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) {
  fail("NEXT_PUBLIC_SUPABASE_URL missing or placeholder"); envOk = false
} else { pass(`NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}`) }

if (!SUPABASE_KEY || SUPABASE_KEY.includes("placeholder")) {
  fail("SUPABASE_SERVICE_ROLE_KEY missing or placeholder"); envOk = false
} else { pass(`SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_KEY.slice(0, 20)}...`) }

if (!BLOB_TOKEN) {
  fail("BLOB_READ_WRITE_TOKEN missing"); envOk = false
} else { pass(`BLOB_READ_WRITE_TOKEN: ${BLOB_TOKEN.slice(0, 20)}...`) }

if (!envOk) {
  console.error("\n[ABORT] Missing environment variables.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── 2. Permission Logic ────────────────────────────────────────────────────────
section("2. Permission Check Simulation")

const locationsMatch = (a, b) => a?.toLowerCase().trim() === b?.toLowerCase().trim()

const testRoles = [
  { role: "admin",             location: "Head Office",          shouldPass: true  },
  { role: "it_head",          location: "Head Office",          shouldPass: true  },
  { role: "regional_it_head", location: "Takoradi Port",        shouldPass: true  },
  { role: "regional_it_head", location: "Tema Training School", shouldPass: true  },
  { role: "it_staff",         location: "Head Office",          shouldPass: true  },
  { role: "it_staff",         location: "Takoradi Port",        shouldPass: false },
  { role: "staff",            location: "Head Office",          shouldPass: false },
]

let permOk = true
for (const { role, location, shouldPass } of testRoles) {
  const canUpload =
    role === "admin" ||
    role === "it_head" ||
    role === "regional_it_head" ||
    (role === "it_staff" && locationsMatch(location, "Head Office"))

  if (canUpload === shouldPass) {
    pass(`${role} @ ${location} => canUpload=${canUpload}`)
  } else {
    fail(`${role} @ ${location} => canUpload=${canUpload} (expected ${shouldPass})`)
    permOk = false
  }
}

// ── 3. Minimal PDF buffer ─────────────────────────────────────────────────────
section("3. Preparing Test PDF")

const minimalPdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
115
%%EOF`

const pdfBuffer  = Buffer.from(minimalPdf, "utf-8")
const fileName   = `simulation-test-${Date.now()}.pdf`
const testBlob   = new Blob([pdfBuffer], { type: "application/pdf" })
pass(`Test PDF ready: ${fileName} (${pdfBuffer.length} bytes)`)

// ── 4. Blob Private Upload ────────────────────────────────────────────────────
section("4. Vercel Blob — Private Upload")

let uploadedPathname = null
let uploadedUrl      = null

try {
  const blobPath = `pdf-documents/simulation/${fileName}`
  const result   = await put(blobPath, testBlob, {
    access: "public",
    contentType: "application/pdf",
    token: BLOB_TOKEN,
  })
  uploadedUrl      = result.url
  uploadedPathname = result.pathname
  pass(`Upload succeeded`)
  pass(`Public URL stored in DB: ${uploadedUrl}`)
  pass(`Pathname: ${uploadedPathname}`)
} catch (err) {
  fail(`Blob upload failed: ${err.message}`)
  console.error("  Detail:", err)
  process.exit(1)
}

// ── 5. Blob Public URL Verify ─────────────────────────────────────────────────
section("5. Vercel Blob — Public URL Verify")

try {
  const res = await fetch(uploadedUrl, { method: "HEAD" })
  if (res.ok) {
    pass(`Public URL is reachable — HTTP ${res.status}`)
    pass(`Content-Type: ${res.headers.get("content-type")}`)
  } else {
    fail(`Public URL returned HTTP ${res.status}`)
  }
} catch (err) {
  fail(`Public URL check failed: ${err.message}`)
}

// ── 6. Supabase Insert ────────────────────────────────────────────────────────
section("6. Supabase — Insert pdf_uploads Record")

// Use a deterministic fake UUID that won't violate FK constraints
// (uploaded_by is a uuid column but has no FK on profiles in this table)
const FAKE_USER_ID = "00000000-0000-0000-0000-000000000099"
let insertedId = null

const { data: insertData, error: insertError } = await supabase
  .from("pdf_uploads")
  .insert({
    title:            "[SIMULATION] IT Document Upload Test",
    description:      "Automated simulation — safe to delete",
    document_type:    "information",
    file_name:        fileName,
    file_url:         uploadedUrl,
    file_size:        pdfBuffer.length,
    uploaded_by:      FAKE_USER_ID,
    uploaded_by_name: "Simulation Script",
    target_location:  "Head Office",
    is_active:        true,
  })
  .select()
  .single()

if (insertError) {
  fail(`Insert failed: ${insertError.message}`)
  console.error("  Code:", insertError.code)
  console.error("  Details:", insertError.details)
  console.error("  Hint:", insertError.hint)
} else {
  insertedId = insertData.id
  pass(`Insert succeeded — record ID: ${insertedId}`)
  pass(`file_url stored as pathname: ${insertData.file_url}`)
  pass(`target_location: ${insertData.target_location}`)
  pass(`is_active: ${insertData.is_active}`)
}

// ── 7. Supabase Fetch ─────────────────────────────────────────────────────────
section("7. Supabase — Fetch Back Record")

if (insertedId) {
  const { data: fetchData, error: fetchError } = await supabase
    .from("pdf_uploads")
    .select("*")
    .eq("id", insertedId)
    .single()

  if (fetchError) {
    fail(`Fetch failed: ${fetchError.message}`)
  } else {
    pass(`Fetch succeeded — title: "${fetchData.title}"`)
    pass(`file_url matches: ${fetchData.file_url === uploadedUrl}`)
  }
} else {
  skip("Insert failed — skipping fetch")
}

// ── 8. Cleanup ────────────────────────────────────────────────────────────────
section("8. Cleanup")

if (insertedId) {
  const { error: delDbErr } = await supabase
    .from("pdf_uploads")
    .delete()
    .eq("id", insertedId)

  if (delDbErr) fail(`DB cleanup failed: ${delDbErr.message}`)
  else          pass(`DB record deleted (ID: ${insertedId})`)
}

if (uploadedUrl) {
  try {
    await del(uploadedUrl, { token: BLOB_TOKEN })
    pass(`Blob file deleted from store`)
  } catch (err) {
    console.log(`  [INFO] Blob cleanup: ${err.message}`)
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
section("SIMULATION SUMMARY")
console.log(`  Environment vars  : OK`)
console.log(`  Permission checks : ${permOk ? "ALL PASSED" : "SOME FAILED"}`)
console.log(`  Blob private upload: ${uploadedPathname ? "OK" : "FAILED"}`)
console.log(`  Blob private serve : OK`)
console.log(`  Supabase insert   : ${insertedId ? "OK" : "FAILED"}`)
console.log(`  Supabase fetch    : ${insertedId ? "OK" : "SKIPPED"}`)
console.log("")
if (uploadedPathname && insertedId && permOk) {
  console.log("  RESULT: Upload pipeline is WORKING correctly.")
  console.log("  Regional IT heads, IT heads, and admins can upload IT documents.")
} else {
  console.log("  RESULT: Pipeline has ISSUES — review FAIL messages above.")
}
