import fs from "node:fs"
import Papa from "papaparse"

const VALID_STATUSES = new Set(["active", "repair", "maintenance", "retired"])
const VALID_TYPES = new Set([
  "laptop", "desktop", "monitor", "printer", "router", "switch", "keyboard",
  "mouse", "tablet", "mobile_phone", "scanner", "access_point", "other", "multimedia_projector"
])

function normalizeType(v) {
  return String(v || "").trim().toLowerCase().replace(/[\s-]+/g, "_") || "other"
}

function parseCsv(path) {
  const text = fs.readFileSync(path, "utf8")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  return parsed.data
}

function normalizeDate(v) {
  const raw = String(v || "").trim()
  if (!raw) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function validateRows(rows, existingSerials, skipDuplicates) {
  const errors = []
  const warnings = []
  const valid = []
  const seen = new Set()

  rows.forEach((r, idx) => {
    const row = idx + 2
    const device_type = normalizeType(r.device_type)
    const status = String(r.status || "active").trim().toLowerCase()
    const serial_number = String(r.serial_number || "").trim() || `AUTO-${Date.now()}-${row}`
    const purchase_date = normalizeDate(r.purchase_date)
    const warranty_expiry = normalizeDate(r.warranty_expiry)

    if (!VALID_TYPES.has(device_type)) {
      errors.push({ row, field: "device_type", message: "Device type not found", value: r.device_type })
      return
    }

    if (!VALID_STATUSES.has(status)) {
      errors.push({ row, field: "status", message: "Invalid status", value: r.status })
      return
    }

    if (r.purchase_date && !purchase_date) {
      errors.push({ row, field: "purchase_date", message: "Invalid date format", value: r.purchase_date })
      return
    }

    if (r.warranty_expiry && !warranty_expiry) {
      errors.push({ row, field: "warranty_expiry", message: "Invalid date format", value: r.warranty_expiry })
      return
    }

    const serialLower = serial_number.toLowerCase()
    if (seen.has(serialLower)) {
      warnings.push({ row, field: "serial_number", message: "Duplicate in file", value: serial_number })
      return
    }

    if (existingSerials.has(serialLower)) {
      if (skipDuplicates) {
        warnings.push({ row, field: "serial_number", message: "Already exists, skipped", value: serial_number })
        return
      }
      errors.push({ row, field: "serial_number", message: "Already exists", value: serial_number })
      return
    }

    seen.add(serialLower)
    valid.push({
      device_type,
      brand: String(r.brand || "Unknown").trim() || "Unknown",
      model: String(r.model || "Unspecified").trim() || "Unspecified",
      serial_number,
      status,
      purchase_date: purchase_date || null,
      warranty_expiry: warranty_expiry || null,
      assigned_to: String(r.assigned_to || "").trim() || null,
      room_number: String(r.room_number || "").trim() || null,
    })
  })

  return { valid, errors, warnings }
}

function runCrudSimulation() {
  const db = []

  const file1 = "test-bulk-import.csv"
  const rows1 = parseCsv(file1)
  const res1 = validateRows(rows1, new Set(db.map((d) => d.serial_number.toLowerCase())), true)
  if (res1.errors.length) throw new Error(`Test1 failed validation: ${JSON.stringify(res1.errors)}`)

  // CREATE
  db.push(...res1.valid)

  // READ
  const readCount = db.filter((d) => d.status === "active").length

  const file2 = "test-bulk-import-with-errors.csv"
  const rows2 = parseCsv(file2)
  const res2 = validateRows(rows2, new Set(db.map((d) => d.serial_number.toLowerCase())), false)

  const file3 = "test-bulk-import-with-errors-FIXED.csv"
  const rows3 = parseCsv(file3)
  const res3 = validateRows(rows3, new Set(db.map((d) => d.serial_number.toLowerCase())), true)
  if (res3.errors.length) throw new Error(`Fixed file still has errors: ${JSON.stringify(res3.errors)}`)
  db.push(...res3.valid)

  // UPDATE
  const first = db.find((d) => d.serial_number === "DL-LAP-001")
  if (first) first.status = "repair"

  // DELETE
  const beforeDelete = db.length
  for (let i = db.length - 1; i >= 0; i -= 1) {
    if (["DL-LAP-002", "HP-DES-002"].includes(db[i].serial_number)) db.splice(i, 1)
  }

  console.log("CRUD SIMULATION SUMMARY")
  console.log(`Create phase imported: ${res1.valid.length}`)
  console.log(`Read phase active devices: ${readCount}`)
  console.log(`Error simulation errors: ${res2.errors.length}, warnings: ${res2.warnings.length}`)
  console.log(`Corrected file imported: ${res3.valid.length}`)
  console.log(`Update phase changed status for DL-LAP-001: ${first ? "yes" : "no"}`)
  console.log(`Delete phase removed: ${beforeDelete - db.length}`)
  console.log(`Final in-memory devices: ${db.length}`)

  if (res2.errors.length > 0) {
    console.log("\nDetected errors from simulation:")
    res2.errors.slice(0, 10).forEach((e) => {
      console.log(`- Row ${e.row} ${e.field}: ${e.message}${e.value ? ` (${e.value})` : ""}`)
    })
  }
}

runCrudSimulation()
