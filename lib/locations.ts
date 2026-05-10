import { getCanonicalLocationName, normalizeLocation } from "./location-filter"

export const LOCATIONS = {
  head_office: "Head Office",
  central_stores: "Central Stores",
  tema_port: "Tema Port",
  takoradi_port: "Takoradi Port",
  tema_research: "Tema Research",
  tema_training_school: "Tema Training School",
  kumasi: "Kumasi",
  kaase_port: "Kaase Port",
  western_south: "Western South",
  western_north: "Western North",
  ho: "Ho",
  sunyani: "Sunyani",
  eastern_region: "Eastern Region",
  swedru_cr: "Swedru/CR",
} as const

export type LocationKey = keyof typeof LOCATIONS
export type LocationValue = (typeof LOCATIONS)[LocationKey]

export function getLocationLabel(key: string): string {
  if (!key) return key
  return LOCATIONS[key as LocationKey] || getCanonicalLocationName(key) || key
}

export function getLocationOptions() {
  const seen = new Set<string>()
  return Object.entries(LOCATIONS)
    .filter(([, label]) => {
      if (seen.has(label)) return false
      seen.add(label)
      return true
    })
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getLocationKey(location?: string): LocationKey {
  if (!location) return "head_office"
  const canonicalName = getCanonicalLocationName(location)
  const normalizedCanonical = normalizeLocation(canonicalName)
  const match = Object.entries(LOCATIONS).find(([, label]) => normalizeLocation(label) === normalizedCanonical)
  return (match?.[0] as LocationKey) || "head_office"
}

export async function fetchLocationsFromDatabase(): Promise<{ code: string; name: string }[]> {
  try {
    const res = await fetch("/api/admin/lookup-data?type=locations")
    if (res.ok) {
      const data = await res.json()
      return data
        .filter((loc: any) => loc.is_active)
        .map((loc: any) => ({
          code: loc.code,
          name: loc.name,
        }))
    }
  } catch (error) {
    console.error("Error fetching locations:", error)
  }
  // Fallback to hardcoded locations
  return Object.entries(LOCATIONS).map(([code, name]) => ({ code, name }))
}

export function getLocationName(code: string, locations: { code: string; name: string }[]): string {
  const location = locations.find((loc) => loc.code.toLowerCase() === code.toLowerCase())
  return location?.name || getLocationLabel(code) || code
}
