export const DEPARTMENT_OPTIONS = [
  "HR",
  "LEGAL",
  "ITD",
  "ACCOUNTS",
  "AUDIT",
  "RESEARCH",
  "PROCUREMENT",
  "MARKETING",
  "OPERATIONS",
  "SECURITY",
  "TRANSPORT",
  "OTHERS",
] as const

const DEPARTMENT_ALIASES: Record<string, (typeof DEPARTMENT_OPTIONS)[number]> = {
  HR: "HR",
  "HUMAN RESOURCE": "HR",
  "HUMAN RESOURCES": "HR",

  LEGAL: "LEGAL",

  ITD: "ITD",
  IT: "ITD",
  "IT DEPARTMENT": "ITD",
  "INFORMATION TECHNOLOGY": "ITD",

  ACCOUNTS: "ACCOUNTS",
  ACCOUNT: "ACCOUNTS",
  FINANCE: "ACCOUNTS",

  AUDIT: "AUDIT",

  RESEARCH: "RESEARCH",

  PROCUREMENT: "PROCUREMENT",
  PURCHASE: "PROCUREMENT",

  MARKETING: "MARKETING",

  OPERATIONS: "OPERATIONS",
  OPERATION: "OPERATIONS",

  "SECURITY AND TRANSPORT": "SECURITY",
  "TRANSPORT AND SECURITY": "TRANSPORT",
  "SECURITY & TRANSPORT": "SECURITY",
  SECURITY: "SECURITY",
  TRANSPORT: "TRANSPORT",

  OTHERS: "OTHERS",
  OTHER: "OTHERS",
}

export function normalizeDepartmentName(value?: string | null): string {
  const canonical = String(value || "")
    .toUpperCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return DEPARTMENT_ALIASES[canonical] || ""
}

export function isITDDepartment(value?: string | null): boolean {
  return normalizeDepartmentName(value) === "ITD"
}

export function isAllowedDepartment(value?: string | null): boolean {
  return DEPARTMENT_OPTIONS.includes(normalizeDepartmentName(value) as (typeof DEPARTMENT_OPTIONS)[number])
}