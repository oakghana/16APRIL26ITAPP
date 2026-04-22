import Papa from "papaparse"
import {
  buildDeviceTypeOptions,
  DEFAULT_DEVICE_TYPE_CODE,
  normalizeDeviceTypeCode,
} from "@/lib/device-types"

export interface DeviceImportRecord {
  device_type: string
  brand: string
  model: string
  serial_number: string
  status?: string
  purchase_date?: string
  warranty_expiry?: string
  assigned_to?: string
  room_number?: string
  building?: string
  floor?: string
  toner_type?: string
  toner_model?: string
  toner_yield?: string
  monthly_print_volume?: string
}

export interface ValidationError {
  row: number
  field: string
  message: string
  value?: string
}

export interface ValidationResult {
  isValid: boolean
  records: DeviceImportRecord[]
  errors: ValidationError[]
  warnings: ValidationError[]
}

export const DEVICE_STATUSES = ["active", "repair", "maintenance", "retired"]

const FIELD_ALIASES: Record<string, string> = {
  "device_type": "device_type",
  "device type": "device_type",
  "type": "device_type",
  "category": "device_type",

  "brand": "brand",
  "make": "brand",
  "manufacturer": "brand",

  "model": "model",
  "device_model": "model",

  "serial_number": "serial_number",
  "serial number": "serial_number",
  "serial": "serial_number",
  "sn": "serial_number",

  "status": "status",
  "state": "status",

  "purchase_date": "purchase_date",
  "purchase date": "purchase_date",

  "warranty_expiry": "warranty_expiry",
  "warranty expiry": "warranty_expiry",
  "warranty_end": "warranty_expiry",

  "assigned_to": "assigned_to",
  "assigned to": "assigned_to",
  "assigned_user": "assigned_to",

  "room_number": "room_number",
  "room": "room_number",

  "building": "building",
  "floor": "floor",
  "floor_level": "floor",

  "toner_type": "toner_type",
  "toner model": "toner_model",
  "toner_model": "toner_model",
  "toner yield": "toner_yield",
  "toner_yield": "toner_yield",
  "monthly_print_volume": "monthly_print_volume",
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[\s-]+/g, "_").trim()
}

function normalizeRecord(record: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const [rawKey, value] of Object.entries(record || {})) {
    const normalizedRaw = normalizeHeader(String(rawKey || ""))
    const mapped = FIELD_ALIASES[normalizedRaw] || normalizedRaw
    out[mapped] = value
  }
  return out
}

function normalizeDateFlexible(value?: string): string | undefined {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw) return undefined

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // dd/mm/yyyy or mm/dd/yyyy fallback
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const a = Number(slash[1])
    const b = Number(slash[2])
    const y = Number(slash[3])
    const day = a > 12 ? a : b
    const month = a > 12 ? b : a
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

function parseAsJson(text: string): any[] | null {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === "object") return [parsed]
    return null
  } catch {
    return null
  }
}

function parseAsDelimitedText(text: string): any[] {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimiter: "", // auto-detect
  })

  if (parsed.errors?.length) {
    // Best-effort fallback: treat as line-per-row plain text
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ model: line }))
  }

  return (parsed.data as any[]) || []
}

export function parseImportFile(fileText: string): Promise<any[]> {
  return new Promise((resolve) => {
    const trimmed = (fileText || "").trim()
    if (!trimmed) {
      resolve([])
      return
    }

    const asJson = parseAsJson(trimmed)
    if (asJson) {
      resolve(asJson)
      return
    }

    resolve(parseAsDelimitedText(trimmed))
  })
}

function buildRecord(
  rawRecord: any,
  rowNumber: number,
  allowedDeviceTypes: Set<string>
): { record: DeviceImportRecord | null; errors: ValidationError[] } {
  const errors: ValidationError[] = []
  const record = normalizeRecord(rawRecord || {})

  const rawType = String(record.device_type || "").trim()
  const normalizedType = normalizeDeviceTypeCode(rawType)
  const deviceType = rawType ? (allowedDeviceTypes.has(normalizedType) ? normalizedType : normalizedType) : DEFAULT_DEVICE_TYPE_CODE

  const rawStatus = String(record.status || "").trim().toLowerCase()
  const status = DEVICE_STATUSES.includes(rawStatus) ? rawStatus : "active"

  let serial = String(record.serial_number || "").trim()
  if (!serial) {
    serial = `AUTO-${Date.now()}-${rowNumber}`
  }

  const clean: DeviceImportRecord = {
    device_type: deviceType,
    brand: String(record.brand || "Unknown").trim() || "Unknown",
    model: String(record.model || "Unspecified").trim() || "Unspecified",
    serial_number: serial,
    status,
    purchase_date: normalizeDateFlexible(String(record.purchase_date || "")),
    warranty_expiry: normalizeDateFlexible(String(record.warranty_expiry || "")),
    assigned_to: String(record.assigned_to || "").trim() || undefined,
    room_number: String(record.room_number || "").trim() || undefined,
    building: String(record.building || "").trim() || undefined,
    floor: String(record.floor || "").trim() || undefined,
    toner_type: String(record.toner_type || "").trim() || undefined,
    toner_model: String(record.toner_model || "").trim() || undefined,
    toner_yield: String(record.toner_yield || "").trim() || undefined,
    monthly_print_volume: String(record.monthly_print_volume || "").trim() || undefined,
  }

  if (!clean.serial_number) {
    errors.push({ row: rowNumber, field: "serial_number", message: "Could not generate serial number" })
    return { record: null, errors }
  }

  return { record: clean, errors }
}

export async function validateCsvImport(
  fileOrText: File | string,
  existingSerialNumbers: Set<string>,
  options?: { skipDuplicates?: boolean; allowedDeviceTypes?: string[] }
): Promise<ValidationResult> {
  try {
    const allowedDeviceTypes = new Set(
      (options?.allowedDeviceTypes?.length ? options.allowedDeviceTypes : buildDeviceTypeOptions([]).map((type) => type.code))
        .map((type) => normalizeDeviceTypeCode(type))
    )

    const text = typeof fileOrText === "string" ? fileOrText : await fileOrText.text()
    const rows = await parseImportFile(text)

    if (rows.length === 0) {
      return {
        isValid: false,
        records: [],
        errors: [{ row: 0, field: "file", message: "Import file is empty" }],
        warnings: [],
      }
    }

    const validRecords: DeviceImportRecord[] = []
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []
    const seenInFile = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const { record, errors: rowErrors } = buildRecord(rows[i], rowNumber, allowedDeviceTypes)

      if (!record) {
        errors.push(...rowErrors)
        continue
      }

      const serialLower = record.serial_number.toLowerCase()

      if (seenInFile.has(serialLower)) {
        warnings.push({
          row: rowNumber,
          field: "serial_number",
          message: "Duplicate serial in the uploaded file, row skipped",
          value: record.serial_number,
        })
        continue
      }

      if (existingSerialNumbers.has(serialLower)) {
        if (options?.skipDuplicates) {
          warnings.push({
            row: rowNumber,
            field: "serial_number",
            message: "Already exists in system, row skipped",
            value: record.serial_number,
          })
          continue
        }
        errors.push({
          row: rowNumber,
          field: "serial_number",
          message: "Serial number already exists",
          value: record.serial_number,
        })
        continue
      }

      seenInFile.add(serialLower)
      validRecords.push(record)
    }

    return {
      isValid: errors.length === 0,
      records: validRecords,
      errors,
      warnings,
    }
  } catch (error: any) {
    return {
      isValid: false,
      records: [],
      errors: [{ row: 0, field: "file", message: error?.message || "Unable to parse import file" }],
      warnings: [],
    }
  }
}

export function generateCsvTemplate(): string {
  const headers = [
    "device_type",
    "brand",
    "model",
    "serial_number",
    "status",
    "purchase_date",
    "warranty_expiry",
    "assigned_to",
    "room_number",
  ]

  const examples = [
    ["laptop", "Dell", "Latitude 5520", "SN12345", "active", "2023-01-15", "2025-01-15", "John Doe", "204"],
    ["monitor", "HP", "EliteDisplay E243", "MON-001", "active", "", "", "", ""],
    ["network_cable", "D-Link", "Cat6 Patch Cable", "CAB-100", "active", "", "", "", ""],
  ]

  return [headers.join(","), ...examples.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")
}
