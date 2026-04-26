export const APP_SYSTEM_OPTIONS = [
  "Email System",
  "PF and Mutual System",
  "Marketing App",
  "ACCPAC",
  "PERSOL",
  "SharePoint",
  "Loan App",
  "Wireless Access",
  "Asset App",
  "Chemstore App",
  "QNAP",
  "Voucher Tracker",
  "Registry Scans",
  "Contract",
  "Archival",
  "Transport App",
  "Other",
] as const

export const SOFTWARE_ACCESS_OPTIONS = ["Office 365", ...APP_SYSTEM_OPTIONS.filter((option) => option !== "Other"), "Other"] as const