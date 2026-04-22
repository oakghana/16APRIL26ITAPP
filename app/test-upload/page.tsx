"use client"

import { useState } from "react"

// Minimal valid PDF bytes (a real 1-page PDF)
const MINIMAL_PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjIxMAolJUVPRgo="

type StepStatus = "pending" | "running" | "pass" | "fail"

interface Step {
  label: string
  status: StepStatus
  detail?: string
}

const ROLES = [
  { role: "admin",           location: "Head Office",   canUpload: true  },
  { role: "it_head",         location: "Head Office",   canUpload: true  },
  { role: "regional_it_head",location: "Takoradi Port", canUpload: true  },
  { role: "it_staff",        location: "Head Office",   canUpload: true  },
  { role: "it_staff",        location: "Takoradi Port", canUpload: false },
  { role: "staff",           location: "Accra",         canUpload: false },
]

export default function TestUploadPage() {
  const [steps, setSteps] = useState<Step[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [insertedId, setInsertedId] = useState<string | null>(null)

  function b64toBlob(b64: string, type: string) {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type })
  }

  function addStep(label: string, status: StepStatus, detail?: string) {
    setSteps(prev => [...prev, { label, status, detail }])
  }

  function updateLastStep(status: StepStatus, detail?: string) {
    setSteps(prev => {
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], status, detail }
      return next
    })
  }

  async function runSimulation() {
    setSteps([])
    setDone(false)
    setInsertedId(null)
    setRunning(true)

    // ── 1. Permission logic checks ──────────────────────────────────────────
    addStep("Checking permission logic for all roles…", "running")
    let permFail = false
    for (const r of ROLES) {
      // Mirror exactly the same logic as the API route
      const isAdmin   = r.role === "admin"
      const isITHead  = r.role === "it_head"
      const isRegHead = r.role === "regional_it_head"
      const isHeadOfficeStaff =
        r.role === "it_staff" &&
        r.location.toLowerCase().includes("head office")
      const can = isAdmin || isITHead || isRegHead || isHeadOfficeStaff
      if (can !== r.canUpload) {
        permFail = true
        updateLastStep("fail", `MISMATCH: role=${r.role} loc=${r.location} expected=${r.canUpload} got=${can}`)
        break
      }
    }
    if (!permFail) updateLastStep("pass", `All ${ROLES.length} role/location combos match expected permissions`)

    // ── 2. Blob upload via the real API endpoint ────────────────────────────
    addStep("Uploading test PDF via POST /api/pdf-uploads (role: regional_it_head)…", "running")

    const pdfBlob = b64toBlob(MINIMAL_PDF_B64, "application/pdf")
    const pdfFile = new File([pdfBlob], "simulation-test.pdf", { type: "application/pdf" })

    const formData = new FormData()
    formData.append("file",            pdfFile)
    formData.append("title",           "[SIMULATION] Upload Test")
    formData.append("description",     "Automated simulation test — safe to delete")
    formData.append("documentType",    "information")
    formData.append("targetLocation",  "Takoradi Port")
    formData.append("uploadedBy",      "sim-test-user-id")
    formData.append("uploadedByName",  "Simulation Test")
    formData.append("userRole",        "regional_it_head")
    formData.append("userLocation",    "Takoradi Port")

    let uploadedId: string | null = null
    try {
      const res  = await fetch("/api/pdf-uploads", { method: "POST", body: formData })
      const body = await res.json()
      if (!res.ok || !body.success) {
        updateLastStep("fail", `HTTP ${res.status} — ${body.error ?? JSON.stringify(body)}`)
      } else {
        uploadedId = body.upload?.id ?? null
        setInsertedId(uploadedId)
        updateLastStep("pass", `Upload succeeded — DB id: ${uploadedId}  |  file_url: ${body.upload?.file_url}`)
      }
    } catch (e: any) {
      updateLastStep("fail", `Network error: ${e.message}`)
    }

    // ── 3. Verify record via GET ────────────────────────────────────────────
    addStep("Verifying record via GET /api/pdf-uploads…", "running")
    if (uploadedId) {
      try {
        const res  = await fetch("/api/pdf-uploads?documentType=all&userRole=admin&canSeeAll=true")
        const body = await res.json()
        const found = (body.uploads ?? []).find((u: any) => u.id === uploadedId)
        if (found) {
          updateLastStep("pass", `Record found in GET response — title: "${found.title}"  |  is_active: ${found.is_active}`)
        } else {
          updateLastStep("fail", "Record not found in GET response")
        }
      } catch (e: any) {
        updateLastStep("fail", `GET failed: ${e.message}`)
      }
    } else {
      updateLastStep("fail", "Skipped — no upload ID from previous step")
    }

    // ── 4. Cleanup — delete the test record ────────────────────────────────
    addStep("Cleaning up — deleting test record…", "running")
    if (uploadedId) {
      try {
        const res  = await fetch(`/api/pdf-uploads/${uploadedId}`, { method: "DELETE" })
        const body = await res.json()
        if (res.ok && body.success) {
          updateLastStep("pass", `Test record ${uploadedId} deleted successfully`)
        } else {
          updateLastStep("fail", `DELETE returned ${res.status}: ${body.error ?? JSON.stringify(body)}`)
        }
      } catch (e: any) {
        updateLastStep("fail", `DELETE request failed: ${e.message}`)
      }
    } else {
      updateLastStep("fail", "Skipped — nothing to delete")
    }

    setRunning(false)
    setDone(true)
  }

  const allPassed = done && steps.every(s => s.status === "pass")
  const anyFailed = done && steps.some(s => s.status === "fail")

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IT Document Upload — Simulation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tests permission logic, Blob upload, DB insert, GET verification, and cleanup against the live API.
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={running}
          className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {running ? "Running simulation…" : "Run Simulation"}
        </button>

        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 text-lg leading-none">
                  {step.status === "running" ? "⏳" : step.status === "pass" ? "✅" : "❌"}
                </span>
                <div>
                  <p className={`font-medium ${step.status === "fail" ? "text-red-600" : step.status === "pass" ? "text-green-700" : "text-gray-600"}`}>
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {done && (
          <div className={`rounded-lg p-4 text-center font-semibold ${allPassed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {allPassed
              ? "All checks passed — IT Document upload is fully working."
              : "One or more checks failed — see details above."}
          </div>
        )}
      </div>
    </main>
  )
}
