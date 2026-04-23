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

export type ITFormType = "requisition" | "maintenance" | "new-gadget"

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
  const doc = new jsPDF("p", "mm", "a4")
  const logoDataUrl = await getLogoDataUrl()
  const pageWidth = doc.internal.pageSize.getWidth()

  const title =
    data.formType === "maintenance"
      ? "MAINTENANCE AND REPAIRS REQUEST FORM"
      : data.formType === "new-gadget"
        ? "NEW IT GADGET REQUEST FORM"
        : "REQUISITION FORM: COMPUTER CONSUMABLE (TONER & GADGET)"

  doc.setDrawColor(120, 120, 120)
  doc.rect(10, 8, 190, 279)

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", pageWidth / 2 - 8, 11, 16, 16)
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.text("FOR ISD DEPARTMENT OF QCC", pageWidth / 2, 30, { align: "center" })
  doc.setFontSize(12)
  doc.text(title, pageWidth / 2, 37, { align: "center" })
  doc.setFontSize(8)
  doc.rect(164, 12, 30, 9)
  doc.text(data.requestNumber || COMPANY_REG_TEXT, 179, 18, { align: "center" })

  let y = 47

  y = addSectionHeader(doc, "REQUESTING STAFF INFORMATION", "SECTION A", y)
  y = addFieldLine(doc, "Name of staff making request", blankLineValue(data.staffName), 16, y)
  y = addFieldLine(doc, "Department name", blankLineValue(data.department), 16, y)
  y = addWrappedField(
    doc,
    data.formType === "new-gadget" ? "Complaints / reason" : "Items / complaint",
    blankLineValue(data.summary),
    16,
    y
  )
  y = addWrappedField(doc, "Purpose / notes", blankLineValue(data.purpose || data.extraNotes), 16, y)
  y = addFieldLine(doc, "Date of request", blankLineValue(data.requestDate), 16, y)

  if (data.formType === "requisition") {
    y = addSectionHeader(doc, "REQUISITION DETAILS", "SECTION B", y + 2)
    y = addFieldLine(doc, "Item S/N", blankLineValue(data.serialNumber), 16, y)
    y = addFieldLine(doc, "Supplier name", blankLineValue(data.gadgetMake), 16, y)
    y = addWrappedField(doc, "Items required", blankLineValue(data.summary), 16, y)
    y = addWrappedField(doc, "Purpose", blankLineValue(data.purpose), 16, y)
  }

  if (data.formType === "new-gadget") {
    y = addSectionHeader(doc, "PREVIOUS IT GADGET HISTORY", "SECTION B", y + 2)
    y = addFieldLine(doc, "Make of IT gadget", blankLineValue(data.gadgetMake), 16, y)
    y = addFieldLine(doc, "Serial number", blankLineValue(data.serialNumber), 16, y)
    y = addFieldLine(doc, "Year of purchase", blankLineValue(data.yearOfPurchase), 16, y)
    y = addWrappedField(doc, "Any other comments", blankLineValue(data.extraNotes), 16, y)
  }

  if (data.formType === "maintenance") {
    y = addSectionHeader(doc, "TECHNICIAN USE ONLY: INITIAL DIAGNOSIS", "SECTION B", y + 2)

    const diagnosisItems = data.diagnosisItems?.length
      ? data.diagnosisItems.slice(0, 2)
      : [{ partItem: "", makeSerialNo: "", faultRemarks: "" }, { partItem: "", makeSerialNo: "", faultRemarks: "" }]

    diagnosisItems.forEach((item, index) => {
      y = addFieldLine(doc, `${index + 1}. Part / item`, blankLineValue(item.partItem), 16, y)
      y = addFieldLine(doc, "Make / serial no", blankLineValue(item.makeSerialNo), 80, y - 6)
      y = addFieldLine(doc, "Fault / remarks", blankLineValue(item.faultRemarks), 138, y - 6)
      y += 1
    })

    y = addWrappedField(doc, "Any other comments", blankLineValue(data.extraNotes), 16, y)
    y = addFieldLine(doc, "IT Hardware Supervisor", blankLineValue(data.supervisorName), 16, y)
    y = addFieldLine(doc, "Date", blankLineValue(data.supervisorDate), 126, y - 6)
    y = addFieldLine(doc, "Date of last repairs", blankLineValue(data.lastRepairDate), 16, y)
    y = addFieldLine(doc, "Date of purchase", blankLineValue(data.dateOfPurchase), 96, y - 6)
    y = addFieldLine(doc, "Number of times repaired", blankLineValue(data.timesRepaired), 16, y)
  }

  y = addSectionHeader(doc, "AUTHORIZATION FROM THE HEAD OF DEPARTMENT", "SECTION C", y + 3)
  y = addFieldLine(doc, "Name of sectional / departmental head", blankLineValue(data.hodName), 16, y)
  y = addFieldLine(doc, "Date", blankLineValue(data.hodDate), 126, y - 6)
  y = addSignatureField(doc, "Stamp / Signature", data.hodSignature, 16, y)

  y = addSectionHeader(doc, "IS MANAGER / OFFICE USE ONLY", "SECTION D", y + 3)

  if (data.formType === "new-gadget") {
    y = addCheckboxRow(doc, "Recommended", formatRecommendation(data.recommendation).toLowerCase(), [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ], y)
  }

  y = addFieldLine(doc, data.formType === "requisition" ? "Approved / issued by" : "Confirmed by", blankLineValue(data.managerName), 16, y)
  y = addFieldLine(doc, "Date", blankLineValue(data.managerDate), 126, y - 6)
  y = addSignatureField(doc, "IT Head / Admin Signature", data.managerSignature, 16, y)

  if (data.formType === "maintenance") {
    y = addCheckboxRow(doc, "Was your repaired gadget working properly?", data.repairStatus || "", [
      { label: "Working perfectly well now", value: "working_perfectly" },
      { label: "In the same bad condition", value: "same_bad_condition" },
    ], y + 1)
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(90, 90, 90)
  doc.text(`${BRAND_NAME}`, 14, 283)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 283, { align: "right" })

  doc.save(`${data.fileName}-${new Date().toISOString().split("T")[0]}.pdf`)
}
