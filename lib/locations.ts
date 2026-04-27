export const LOCATIONS = {
  head_office: "Head Office",
  central_stores: "Central Stores",
  tema_port: "Tema Port",
  takoradi_port: "Takoradi Port",
  tema_research: "Tema Research",
  tema_training_school: "Tema Training School",
  kumasi: "Kumasi",
  kaase: "Kaase",
  western_south: "Western South",
  western_north: "Western North",
  vr: "VR",
  bar: "BAR",
  eastern: "Eastern",
  nsawam: "Nsawam",
  cr: "Swedru/CR",
  cape_coast: "Swedru/CR",
  sunyani: "Sunyani",
} as const

export type LocationKey = keyof typeof LOCATIONS
export type LocationValue = (typeof LOCATIONS)[LocationKey]

export function getLocationLabel(key: string): string {
  return LOCATIONS[key as LocationKey] || key
}

export function getLocationOptions() {
  return Object.entries(LOCATIONS).map(([value, label]) => ({
    value,
    label,
  }))
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
