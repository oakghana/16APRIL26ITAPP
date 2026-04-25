import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const BRAND_NAME = "Quality Control Company Limited"
const BRAND_SUBTITLE = "Intranet Report"
const LOGO_PATH = "/images/qcc-logo.png"
const COMPANY_REG_TEXT = "Reg. No 3071"

export interface ExportData {
  title: string
  fileName: string
  headers: string[]
  rows: (string | number)[][]
}

export type ITFormType = "requisition" | "maintenance" | "new-gadget" | "password-reset"

export interface ITFormPDFData {
  formType: ITFormType
  fileName: string
  requestNumber: string
  staffName: string
  department: string
  requestDate: string
  summary: string
  purpose?: string
  status?: string
  gadgetMake?: string
  serialNumber?: string
  yearOfPurchase?: string | number
  dateOfPurchase?: string
  lastRepairDate?: string
  timesRepaired?: string | number
  hodName?: string
  hodDate?: string
  hodSignature?: string
  extraNotes?: string
  diagnosisItems?: Array<{
    partItem?: string
    makeSerialNo?: string
    faultRemarks?: string
  }>
  supervisorName?: string
  supervisorDate?: string
  managerName?: string
  managerDate?: string
  managerSignature?: string
  recommendation?: string | boolean | null
  repairStatus?: string
}

interface SignatureLookupResponse {
  hodSignature?: string | null
  managerSignature?: string | null
}

async function getLogoDataUrl() {
  try {
    const response = await fetch(LOGO_PATH)
    if (!response.ok) return null

    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error("[export-utils] Failed to load report logo:", error)
    return null
  }
}

function formatStatus(status?: string) {
  if (!status) return "Pending"
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function addSectionHeader(doc: jsPDF, title: string, sectionCode: string, y: number) {
  doc.setFillColor(248, 244, 232)
  doc.rect(14, y - 4, 182, 7, "F")
  doc.setDrawColor(120, 120, 120)
  doc.rect(14, y - 4, 182, 7)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text(title, 16, y)
  doc.text(sectionCode, 192, y, { align: "right" })
  return y + 9
}

function addFieldLine(doc: jsPDF, label: string, value: string, x: number, y: number) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`${label}: ${value || "................................"}`, x, y)
  return y + 6
}

function addWrappedField(doc: jsPDF, label: string, value: string, x: number, y: number, valueOffset = 36, maxWidth = 135) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`${label}:`, x, y)
  const safeValue = value?.trim() || "................................"
  const lines = doc.splitTextToSize(safeValue, maxWidth)
  doc.text(lines, x + valueOffset, y)
  return y + Math.max(7, lines.length * 5 + 2)
}

function blankLineValue(value?: string | number | boolean | null, fallback = "................................") {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function normalizeReportNotes(value?: string | null) {
  const raw = (value || "").replace(/\r\n?/g, "\n").trim()
  if (!raw) return ""

  const seen = new Set<string>()
  const dedupedLines: string[] = []

  for (const line of raw.split("\n")) {
    const cleaned = line.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      dedupedLines.push(cleaned)
    }
  }

  return dedupedLines.join("\n")
}

interface ActorNote {
  actor: string
  note: string
  timestamp?: string
}

function parseActorNotes(value?: string | null): ActorNote[] {
  if (!value) return []

  const actorPatterns: Array<{ pattern: RegExp; actor: string }> = [
    { pattern: /^HOD\s+(?:approval|rejection|approved|rejected)\s+note:\s*/i, actor: "Department Head (HOD)" },
    { pattern: /^IT\s+Office\s+Use\s+(?:completed|hold)\s+note:\s*/i, actor: "IT Office Use" },
    { pattern: /^IT\s+Manager\s+(?:approved|rejected)\s+note:\s*/i, actor: "IT Manager" },
    { pattern: /^IT\s+Head\s+(?:approved|rejected)\s+note:\s*/i, actor: "IT Head" },
    { pattern: /^Admin\s+(?:approved|rejected)\s+note:\s*/i, actor: "Admin" },
    { pattern: /^Service\s+Desk\s+(?:processed|hold)\s+note:\s*/i, actor: "Service Desk" },
  ]

  const seen = new Set<string>()
  const results: ActorNote[] = []

  for (const line of value.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    let matched = false
    for (const { pattern, actor } of actorPatterns) {
      if (pattern.test(trimmed)) {
        let noteBody = trimmed.replace(pattern, "")
        // Extract trailing timestamp like (by NAME on ISO_DATE)
        const byMatch = noteBody.match(/\s*\(by\s+(.+?)\s+on\s+([^)]+)\)\s*$/i)
        let timestamp: string | undefined
        if (byMatch) {
          noteBody = noteBody.slice(0, noteBody.length - byMatch[0].length).trim()
          timestamp = byMatch[2]
        }
        results.push({ actor, note: noteBody || "—", timestamp })
        matched = true
        break
      }
    }
    if (!matched && trimmed) {
      results.push({ actor: "Note", note: trimmed })
    }
  }

  return results
}

async function enrichITFormSignatures(data: ITFormPDFData): Promise<ITFormPDFData> {
  if (data.hodSignature && data.managerSignature) return data

  try {
    const response = await fetch("/api/it-forms/signature-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hodName: data.hodName,
        managerName: data.managerName,
      }),
    })

    if (!response.ok) return data

    const payload = (await response.json()) as SignatureLookupResponse
    return {
      ...data,
      hodSignature: data.hodSignature || payload.hodSignature || undefined,
      managerSignature: data.managerSignature || payload.managerSignature || undefined,
    }
  } catch {
    return data
  }
}

async function normalizeSignatureForPdf(signatureDataUrl?: string) {
  if (!signatureDataUrl) return undefined
  if (signatureDataUrl.startsWith("data:image/png")) return signatureDataUrl

  try {
    return await new Promise<string | undefined>((resolve) => {
      const image = new Image()
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = image.naturalWidth || image.width || 1
          canvas.height = image.naturalHeight || image.height || 1
          const context = canvas.getContext("2d")
          if (!context) {
            resolve(signatureDataUrl)
            return
          }
          context.drawImage(image, 0, 0)
          resolve(canvas.toDataURL("image/png"))
        } catch {
          resolve(signatureDataUrl)
        }
      }
      image.onerror = () => resolve(signatureDataUrl)
      image.src = signatureDataUrl
    })
  } catch {
    return signatureDataUrl
  }
}

function formatRecommendation(value?: string | boolean | null) {
  if (value === true || value === "yes") return "Yes"
  if (value === false || value === "no") return "No"
  return ""
}

function addCheckboxRow(doc: jsPDF, label: string, selectedValue: string, options: Array<{ label: string; value: string }>, y: number) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(label, 16, y)

  let x = 118
  options.forEach((option) => {
    doc.rect(x, y - 3, 3.2, 3.2)
    if (selectedValue === option.value) {
      doc.setFont("helvetica", "bold")
      doc.text("X", x + 0.8, y - 0.2)
      doc.setFont("helvetica", "normal")
    }
    doc.text(option.label, x + 5, y)
    x += option.label.length > 18 ? 38 : 30
  })

  return y + 7
}

function addSignatureField(
  doc: jsPDF,
  label: string,
  signatureDataUrl: string | undefined,
  x: number,
  y: number,
) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`${label}:`, x, y)

  const boxX = x + 34
  const boxY = y - 5.5
  const boxW = 78
  const boxH = 12
  doc.setDrawColor(130, 130, 130)
  doc.rect(boxX, boxY, boxW, boxH)

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", boxX + 1, boxY + 1, boxW - 2, boxH - 2)
    } catch {
      doc.setFontSize(8)
      doc.text("[signature image unavailable]", boxX + 2, boxY + 7)
    }
  } else {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text("not signed", boxX + 2, boxY + 7)
    doc.setTextColor(20, 20, 20)
  }

  return y + 8
}

export function downloadCSV(data: ExportData) {
  const { fileName, headers, rows } = data

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const stringCell = String(cell)
          if (stringCell.includes(",") || stringCell.includes('"') || stringCell.includes("\n")) {
            return `"${stringCell.replace(/"/g, '""')}"`
          }
          return stringCell
        })
        .join(","),
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", `${fileName}-${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function printToPDF(elementId: string, fileName: string) {
  const element = document.getElementById(elementId)
  if (!element) {
    console.error(`Element with id "${elementId}" not found`)
    return
  }

  const printWindow = window.open("", "_blank", "width=1024,height=768")
  if (!printWindow) {
    window.print()
    return
  }

  const logoUrl = `${window.location.origin}${LOGO_PATH}`
  printWindow.document.write(`
    <html>
      <head>
        <title>${fileName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          .report-header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #8b5e00; padding-bottom: 14px; margin-bottom: 20px; }
          .report-header img { width: 64px; height: 64px; object-fit: contain; }
          .report-header h1 { margin: 0; font-size: 20px; color: #3b2b12; }
          .report-header p { margin: 4px 0 0; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <img src="${logoUrl}" alt="QCC Logo" />
          <div>
            <h1>${BRAND_NAME}</h1>
            <p>${BRAND_SUBTITLE}</p>
          </div>
        </div>
        ${element.outerHTML}
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

export async function exportToPDF(data: ExportData) {
  const { title, fileName, headers, rows } = data

  const doc = new jsPDF()
  const generatedAt = new Date().toLocaleString()
  const logoDataUrl = await getLogoDataUrl()

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 20, 20)
  }

  doc.setFontSize(14)
  doc.setTextColor(60, 43, 18)
  doc.text(BRAND_NAME, 40, 16)
  doc.setFontSize(10)
  doc.setTextColor(110, 110, 110)
  doc.text(BRAND_SUBTITLE, 40, 22)

  doc.setDrawColor(139, 94, 0)
  doc.line(14, 32, 196, 32)

  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text(title, 14, 42)
  doc.setFontSize(10)
  doc.text(`Generated: ${generatedAt}`, 14, 49)

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 56,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 84, 61] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 20, left: 14, right: 14, bottom: 18 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    doc.text(`${BRAND_NAME} • Page ${i} of ${pageCount}`, 14, 288)
  }

  doc.save(`${fileName}-${new Date().toISOString().split("T")[0]}.pdf`)
}

export async function exportITFormPDF(data: ITFormPDFData) {
  const enrichedData = await enrichITFormSignatures(data)
  const hideHodForPasswordReset = enrichedData.formType === "password-reset"
  const pdfHodSignature = hideHodForPasswordReset ? undefined : await normalizeSignatureForPdf(enrichedData.hodSignature)
  const pdfManagerSignature = await normalizeSignatureForPdf(enrichedData.managerSignature)
  const doc = new jsPDF("p", "mm", "a4")
  const logoDataUrl = await getLogoDataUrl()
  const pageWidth = doc.internal.pageSize.getWidth()
  const generatedAt = new Date().toLocaleString()

  const title =
    enrichedData.formType === "maintenance"
      ? "Maintenance and Repairs Report"
      : enrichedData.formType === "new-gadget"
        ? "New IT Gadget Request Report"
        : enrichedData.formType === "password-reset"
          ? "Password Reset Request Report"
        : "IT Equipment Requisition Report"

  doc.setFillColor(237, 246, 241)
  doc.rect(0, 0, pageWidth, 32, "F")
  doc.setDrawColor(186, 230, 203)
  doc.line(10, 32, pageWidth - 10, 32)

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 12, 8, 14, 14)
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text(BRAND_NAME, 30, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(title, 30, 20)
  doc.text(`Generated: ${generatedAt}`, 30, 25)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(22, 101, 52)
  doc.setDrawColor(167, 243, 208)
  doc.roundedRect(pageWidth - 70, 10, 58, 12, 3, 3)
  doc.text(`Ref: ${enrichedData.requestNumber}`, pageWidth - 41, 17, { align: "center" })

  const summaryRows = [
    ["Request Number", blankLineValue(enrichedData.requestNumber, "-")],
    ["Staff Name", blankLineValue(enrichedData.staffName, "-")],
    ["Department", blankLineValue(enrichedData.department, "-")],
    ["Request Date", blankLineValue(enrichedData.requestDate, "-")],
    ["Status", formatStatus(enrichedData.status)],
  ]

  autoTable(doc, {
    startY: 40,
    head: [["Request Summary", "Details"]],
    body: summaryRows,
    styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold", fillColor: [248, 250, 252] }, 1: { cellWidth: 128 } },
    margin: { left: 14, right: 14 },
  })

  const detailRows: Array<[string, string]> = [
    [enrichedData.formType === "new-gadget" ? "Complaints / Reason" : enrichedData.formType === "password-reset" ? "Account and Issue" : "Request Summary", blankLineValue(enrichedData.summary, "-")],
    ["Purpose / Notes", blankLineValue(normalizeReportNotes(enrichedData.purpose || enrichedData.extraNotes), "-")],
  ]

  if (enrichedData.gadgetMake) detailRows.push(["Make / Supplier", blankLineValue(enrichedData.gadgetMake, "-")])
  if (enrichedData.serialNumber) detailRows.push(["Serial Number", blankLineValue(enrichedData.serialNumber, "-")])
  if (enrichedData.yearOfPurchase !== undefined && enrichedData.yearOfPurchase !== null) detailRows.push(["Year of Purchase", blankLineValue(enrichedData.yearOfPurchase, "-")])
  if (enrichedData.dateOfPurchase) detailRows.push(["Date of Purchase", blankLineValue(enrichedData.dateOfPurchase, "-")])
  if (enrichedData.lastRepairDate) detailRows.push(["Last Repair Date", blankLineValue(enrichedData.lastRepairDate, "-")])
  if (enrichedData.timesRepaired !== undefined && enrichedData.timesRepaired !== null) detailRows.push(["Times Repaired", blankLineValue(enrichedData.timesRepaired, "-")])
  if (enrichedData.repairStatus) detailRows.push(["Repair Status", blankLineValue(enrichedData.repairStatus, "-")])
  if (enrichedData.formType === "new-gadget") detailRows.push(["Recommendation", blankLineValue(formatRecommendation(enrichedData.recommendation), "-")])

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [["Form Details", "Value"]],
    body: detailRows,
    styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold", fillColor: [248, 250, 252] }, 1: { cellWidth: 128 } },
    margin: { left: 14, right: 14 },
  })

  const approvalsRows: Array<[string, string]> = hideHodForPasswordReset
    ? [
        ["IT Manager / IT Head", blankLineValue(enrichedData.managerName, "-")],
        ["Manager Date", blankLineValue(enrichedData.managerDate, "-")],
      ]
    : [
        ["Department Head", blankLineValue(enrichedData.hodName, "-")],
        ["Department Head Date", blankLineValue(enrichedData.hodDate, "-")],
        ["IT Manager / IT Head", blankLineValue(enrichedData.managerName, "-")],
        ["Manager Date", blankLineValue(enrichedData.managerDate, "-")],
      ]

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [["Approval Summary", "Value"]],
    body: approvalsRows,
    styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold", fillColor: [248, 250, 252] }, 1: { cellWidth: 128 } },
    margin: { left: 14, right: 14 },
  })

  let y = (doc as any).lastAutoTable.finalY + 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text("Signatures", 14, y)
  y += 4

  doc.setDrawColor(148, 163, 184)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)

  if (hideHodForPasswordReset) {
    doc.rect(14, y, 182, 24)
    doc.text("IT Manager / IT Head Signature", 16, y + 4)

    if (pdfManagerSignature) {
      try {
        doc.addImage(pdfManagerSignature, "PNG", 16, y + 6, 178, 16)
      } catch {
        doc.text("signature image unavailable", 16, y + 14)
      }
    } else {
      doc.text("not signed", 16, y + 14)
    }
  } else {
    doc.rect(14, y, 86, 24)
    doc.rect(110, y, 86, 24)
    doc.text("Department Head Signature", 16, y + 4)
    doc.text("IT Manager / IT Head Signature", 112, y + 4)

    if (pdfHodSignature) {
      try {
        doc.addImage(pdfHodSignature, "PNG", 16, y + 6, 82, 16)
      } catch {
        doc.text("signature image unavailable", 16, y + 14)
      }
    } else {
      doc.text("not signed", 16, y + 14)
    }

    if (pdfManagerSignature) {
      try {
        doc.addImage(pdfManagerSignature, "PNG", 112, y + 6, 82, 16)
      } catch {
        doc.text("signature image unavailable", 112, y + 14)
      }
    } else {
      doc.text("not signed", 112, y + 14)
    }
  }

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`${BRAND_NAME} • ${COMPANY_REG_TEXT}`, 14, 287)
  doc.text(`Reference: ${blankLineValue(enrichedData.requestNumber, "-")}`, 196, 287, { align: "right" })

  doc.save(`${enrichedData.fileName}-${new Date().toISOString().split("T")[0]}.pdf`)
}

function escapeHtml(value?: string | number | boolean | null) {
  const text = value === undefined || value === null ? "" : String(value)
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildPrintSections(data: ITFormPDFData) {
  const commonRows = [
    ["Request Number", data.requestNumber],
    ["Staff Name", data.staffName],
    ["Department", data.department],
    ["Request Date", data.requestDate],
    ["Status", formatStatus(data.status)],
  ]

  const detailRows: Array<[string, string | number | boolean | null | undefined]> = []
  if (data.formType === "requisition") {
    detailRows.push(["Item S/N", data.serialNumber])
    detailRows.push(["Supplier", data.gadgetMake])
    detailRows.push(["Items Required", data.summary])
    detailRows.push(["Purpose", data.purpose])
  } else if (data.formType === "new-gadget") {
    detailRows.push(["Complaints / Reason", data.summary])
    detailRows.push(["Gadget Make", data.gadgetMake])
    detailRows.push(["Serial Number", data.serialNumber])
    detailRows.push(["Year of Purchase", data.yearOfPurchase])
    detailRows.push(["Recommendation", formatRecommendation(data.recommendation)])
  } else if (data.formType === "password-reset") {
    detailRows.push(["System / Application", data.purpose])
    detailRows.push(["Account Identifier", data.summary])
    detailRows.push(["Work Notes", data.extraNotes])
  } else {
    detailRows.push(["Complaints", data.summary])
    detailRows.push(["Date of Purchase", data.dateOfPurchase])
    detailRows.push(["Date of Last Repairs", data.lastRepairDate])
    detailRows.push(["Times Repaired", data.timesRepaired])
    detailRows.push(["Repair Status", data.repairStatus])
  }

  const approvalsRows: Array<[string, string | number | boolean | null | undefined]> =
    data.formType === "password-reset"
      ? [
          ["IT Manager / IT Head", data.managerName],
          ["Manager Date", data.managerDate],
        ]
      : [
          ["Department Head", data.hodName],
          ["Department Head Date", data.hodDate],
          ["IT Manager / IT Head", data.managerName],
          ["Manager Date", data.managerDate],
        ]

  const actorNotes = parseActorNotes(data.extraNotes || data.purpose)

  return { commonRows, detailRows, approvalsRows, actorNotes }
}

export function openITFormPrintView(data: ITFormPDFData) {
  void (async () => {
    const enrichedData = await enrichITFormSignatures(data)
    const printWindow = window.open("", "_blank", "width=1100,height=820")
    if (!printWindow) {
      window.print()
      return
    }

    const title =
      enrichedData.formType === "maintenance"
        ? "Maintenance and Repairs Request"
        : enrichedData.formType === "new-gadget"
          ? "New IT Gadget Request"
          : enrichedData.formType === "password-reset"
            ? "Password Reset Request"
          : "IT Equipment Requisition"

    const { commonRows, detailRows, approvalsRows, actorNotes } = buildPrintSections(enrichedData)
    const logoUrl = `${window.location.origin}${LOGO_PATH}`
    const hideHodForPasswordReset = enrichedData.formType === "password-reset"
    const hodSignatureImg = enrichedData.hodSignature
      ? `<img src="${escapeHtml(enrichedData.hodSignature)}" alt="HOD Signature" class="sig-img" />`
      : `<span class="sig-empty">not signed</span>`
    const managerSignatureImg = enrichedData.managerSignature
      ? `<img src="${escapeHtml(enrichedData.managerSignature)}" alt="Manager Signature" class="sig-img" />`
      : `<span class="sig-empty">not signed</span>`
    const renderRows = (rows: Array<[string, string | number | boolean | null | undefined]>) =>
      rows
        .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value) || "-"}</td></tr>`)
        .join("")

    const renderActorNotes = (notes: ActorNote[]) => {
      if (!notes.length) return `<tr><th>Notes</th><td>—</td></tr>`
      return notes.map(({ actor, note, timestamp }) =>
        `<tr>
          <th>${escapeHtml(actor)}</th>
          <td>${escapeHtml(note)}${
            timestamp
              ? `<span style="display:block;font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(new Date(timestamp).toLocaleString())}</span>`
              : ""
          }</td>
        </tr>`
      ).join("")
    }

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(enrichedData.requestNumber)} - ${escapeHtml(title)}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          * { box-sizing: border-box; }
          body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #eef3f8; color: #0f172a; }
          .page { width: 194mm; min-height: 280mm; margin: 0 auto; background: #fff; border-radius: 14px; border: 1px solid #d9e2ec; overflow: hidden; box-shadow: 0 20px 35px rgba(15, 23, 42, 0.08); }
          .header { display: flex; justify-content: space-between; align-items: center; padding: 22px 26px; background: linear-gradient(120deg, #ecfdf5, #f8fafc 45%, #eff6ff); border-bottom: 1px solid #dbeafe; }
          .brand { display: flex; gap: 14px; align-items: center; }
          .brand img { width: 54px; height: 54px; object-fit: contain; border-radius: 50%; background: #fff; border: 1px solid #dbeafe; padding: 6px; }
          .brand h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.01em; }
          .brand p { margin: 4px 0 0; color: #475569; font-size: 13px; }
          .meta { text-align: right; }
          .meta .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; }
          .meta .date { margin-top: 8px; color: #64748b; font-size: 12px; }
          .content { padding: 22px 26px 28px; display: grid; gap: 16px; }
          .section { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; }
          .section h2 { margin: 0; padding: 10px 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 13px; }
          th { width: 34%; text-align: left; color: #334155; font-weight: 700; background: #fcfdff; }
          td { color: #0f172a; }
          tr:last-child th, tr:last-child td { border-bottom: 0; }
          .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .sig-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; min-height: 86px; background: #f8fafc; }
          .sig-label { font-size: 12px; color: #334155; font-weight: 700; margin-bottom: 6px; }
          .sig-img { width: 100%; max-height: 56px; object-fit: contain; background: #fff; border: 1px solid #dbeafe; border-radius: 8px; padding: 4px; }
          .sig-empty { display: inline-block; margin-top: 14px; color: #64748b; font-size: 12px; }
          .footer { padding: 14px 26px 20px; color: #64748b; font-size: 12px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; }
          @media print {
            body { background: #fff; }
            .page { width: 100%; min-height: auto; margin: 0; border-radius: 0; box-shadow: none; border: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="brand">
              <img src="${logoUrl}" alt="QCC Logo" />
              <div>
                <h1>${escapeHtml(BRAND_NAME)}</h1>
                <p>${escapeHtml(title)}</p>
              </div>
            </div>
            <div class="meta">
              <div class="pill">${escapeHtml(formatStatus(enrichedData.status))}</div>
              <div class="date">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
            </div>
          </div>

          <div class="content">
            <section class="section">
              <h2>Request Summary</h2>
              <table>${renderRows(commonRows)}</table>
            </section>

            <section class="section">
              <h2>Form Details</h2>
              <table>${renderRows(detailRows)}</table>
            </section>

            <section class="section">
              <h2>Approval and Sign-off</h2>
              <table>${renderRows(approvalsRows)}</table>
            </section>

            <section class="section">
              <h2>Approval Notes</h2>
              <table>${renderActorNotes(actorNotes)}</table>
            </section>

            <section class="section">
              <h2>Signatures</h2>
              <div class="sig-grid" style="padding: 12px; ${hideHodForPasswordReset ? "grid-template-columns: 1fr;" : ""}">
                ${hideHodForPasswordReset ? "" : `<div class="sig-box"><div class="sig-label">Department Head Signature</div>${hodSignatureImg}</div>`}
                <div class="sig-box">
                  <div class="sig-label">IT Manager / IT Head Signature</div>
                  ${managerSignatureImg}
                </div>
              </div>
            </section>
          </div>

          <div class="footer">
            <span>${escapeHtml(BRAND_NAME)} • ${escapeHtml(COMPANY_REG_TEXT)}</span>
            <span>Reference: ${escapeHtml(enrichedData.requestNumber)}</span>
          </div>
        </div>
      </body>
    </html>
  `)

    printWindow.document.close()

    const waitForImages = () => {
      const images = Array.from(printWindow.document.images || [])
      if (images.length === 0) return Promise.resolve()
      return Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
        })
      )
    }

    await waitForImages()
    printWindow.focus()
    printWindow.print()
  })()
}
