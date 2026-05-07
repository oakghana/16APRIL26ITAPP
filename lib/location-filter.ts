import type { User } from "./auth-context"

/**
 * Normalizes location string for case-insensitive comparison
 */
export function normalizeLocation(location: string | null | undefined): string {
  if (!location) return ""
  // Convert to lowercase and handle common variations
  return location.toLowerCase().replace(/[\s_\/-]+/g, "_").trim()
}

/**
 * True when a user location is Head Office / Accra variant.
 */
export function isHeadOfficeOrAccraLocation(location: string | null | undefined): boolean {
  const normalized = normalizeLocation(location)
  return normalized === "head_office" || normalized === "head_office_accra" || normalized === "headoffice" || normalized === "accra"
}

/**
 * Map of normalised keys → canonical display names.
 * Used to merge duplicate / inconsistent location strings coming from the DB
 * into a single entry for reports and charts.
 */
const LOCATION_CANONICAL_MAP: Record<string, string> = {
  tema_training_school: "Tema Training School-TSCH",
  tema_research: "Tema Research",
  takoradi_port: "Takoradi Port",
  takoradi: "Takoradi Port",
  // Merge all Head Office variants → "Head Office"
  head_office: "Head Office",
  "head_office_accra": "Head Office",
  "head_office-accra": "Head Office",
  "headoffice": "Head Office",
  accra: "Head Office",
  // Merge all Western North variants → "Western North"
  wn: "Western North",
  western_north: "Western North",
  // Merge all Western South variants → "Western South"
  ws: "Western South",
  western_south: "Western South",
  // Regional aliases
  cr: "Swedru/CR",
  cape_coast: "Swedru/CR",
  central_region: "Swedru/CR",
  swedru_cr: "Swedru/CR",
  "swedru/cr": "Swedru/CR",
  vr: "Ho",
  ho: "Ho",
  volta: "Ho",
  bar: "Sunyani",
  brong_ahafo: "Sunyani",
  sunyani: "Sunyani",
  eastern: "Eastern",
  nsawam: "Eastern",
}

const LOCATION_ALIAS_GROUPS: Record<string, string[]> = {
  "Swedru/CR": ["Swedru/CR", "Swedru CR", "CR", "Cape Coast", "Central Region", "cape_coast", "cr", "central_region", "swedru_cr", "swedru/cr"],
  "Ho": ["VR", "Ho", "Volta", "vr", "ho", "volta"],
  "Sunyani": ["BAR", "Sunyani", "Brong Ahafo", "bar", "sunyani", "brong_ahafo"],
  "Takoradi Port": ["Takoradi Port", "Takoradi", "takoradi_port", "takoradi"],
  "Head Office": ["Head Office", "head_office", "HeadOffice", "Head Office Accra", "Accra", "accra"],
}

export function getLocationAliases(location: string | null | undefined): string[] {
  if (!location) return []
  const canonical = getCanonicalLocationName(location)
  const aliases = LOCATION_ALIAS_GROUPS[canonical] || [location, canonical]
  return Array.from(new Set([location, canonical, ...aliases].filter(Boolean)))
}

/**
 * Returns the canonical display name for a location.
 * If the location matches a known variant it is mapped to the canonical name,
 * otherwise the original string is returned as-is.
 */
export function getCanonicalLocationName(location: string | null | undefined): string {
  if (!location) return "Unspecified"
  const key = normalizeLocation(location)
  return LOCATION_CANONICAL_MAP[key] ?? location
}

/**
 * Case-insensitive location comparison
 */
export function locationsMatch(loc1: string | null | undefined, loc2: string | null | undefined): boolean {
  if (!loc1 || !loc2) return false

  const directMatch = normalizeLocation(loc1) === normalizeLocation(loc2)
  const canonicalMatch = normalizeLocation(getCanonicalLocationName(loc1)) === normalizeLocation(getCanonicalLocationName(loc2))

  return directMatch || canonicalMatch
}

/**
 * Determine whether two locations should be considered part of the same
 * geographic region.  This mirrors the heuristic used by the backend when
 * filtering tickets for regional IT heads.  It allows a user at "Kumasi"
 * to match tickets for "Kumasi Branch" or "Kumasi - Warehouse" but not
 * unrelated locations.
 */
export function isLocationInSameRegion(
  loc1: string | null | undefined,
  loc2: string | null | undefined
): boolean {
  if (!loc1 || !loc2) return false

  const a = normalizeLocation(loc1)
  const b = normalizeLocation(loc2)

  // Strongest check first: canonical alias mapping (e.g. VR -> Ho).
  const canonicalA = normalizeLocation(getCanonicalLocationName(loc1))
  const canonicalB = normalizeLocation(getCanonicalLocationName(loc2))
  if (canonicalA && canonicalB && canonicalA === canonicalB) return true

  // Alias-group check to catch all configured variants.
  const aliasesA = new Set(getLocationAliases(loc1).map((v) => normalizeLocation(v)))
  const aliasesB = new Set(getLocationAliases(loc2).map((v) => normalizeLocation(v)))
  for (const alias of aliasesA) {
    if (aliasesB.has(alias)) return true
  }

  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true

  const partsA = a.split(/[,\s]+/).filter(p => p.length > 2)
  const partsB = b.split(/[,\s]+/).filter(p => p.length > 2)
  const keyA = partsA[0] || a
  const keyB = partsB[0] || b

  return keyA === keyB && keyA.length > 3
}

/**
 * Determines if a user can see all locations
 * Only Admin and IT Head at Head Office have access to all locations
 * Regional IT heads and other users are restricted to their specific location
 */
export function canSeeAllLocations(userOrRole: User | string | null): boolean {
  if (!userOrRole) return false
  
  // Handle case where just a role string is passed
  if (typeof userOrRole === "string") {
    return userOrRole === "admin" || userOrRole === "it_head" || userOrRole === "it_store_head"
  }
  
  // Handle full User object
  const user = userOrRole
  if (user.role === "admin") return true
  if (user.role === "it_head") return true
  if (user.role === "it_store_head") return true
  if (user.role === "it_staff" && locationsMatch(user.location, "head_office")) return true
  return false
}

/**
 * Determines if a user can assign tasks and manage regional staff
 * Regional IT heads have this permission for their location only
 */
export function canManageRegionalStaff(user: User | null): boolean {
  if (!user) return false
  return user.role === "admin" || user.role === "it_head" || user.role === "regional_it_head"
}

/**
 * Gets the location filter for queries
 * Returns null if user can see all locations, otherwise returns their location
 * Users, regional IT heads, and non-Head Office staff can only see their location data
 * PLUS Central Stores items which are visible to all IT staff
 */
export function getLocationFilter(user: User | null): string | null {
  if (!user) return null
  if (canSeeAllLocations(user)) return null
  return user.location || null
}

/**
 * Applies location filter to a Supabase query
 * Only filters if user cannot see all locations
 * Regional IT heads and regular users will have their location filter applied
 * BUT will also see Central Stores items which are shared across all locations
 */
export function applyLocationFilter<T>(query: T, user: User | null, columnName = "location"): T {
  const locationFilter = getLocationFilter(user)
  if (locationFilter) {
    const aliases = [...getLocationAliases(locationFilter), "Central Stores"]
    const clauses = aliases
      .map((alias) => alias.replace(/[,%()]/g, "").trim())
      .filter(Boolean)
      .map((alias) => `${columnName}.ilike.%${alias}%`)

    // @ts-ignore - Dynamic query building for Supabase/PostgREST
    return query.or(clauses.join(","))
  }
  return query
}

/**
 * Checks if a user can view data for a specific location
 * Admin and Head Office IT staff can view all locations
 * Regional IT heads and other users can view their own location's data
 * PLUS Central Stores items which are visible to everyone
 */
export function canViewLocation(user: User | null, location: string): boolean {
  if (!user) return false
  if (canSeeAllLocations(user)) return true
  if (locationsMatch(location, "Central Stores")) return true
  return locationsMatch(user.location, location)
}

/**
 * Checks if a user can edit data for a specific location
 * Admin and Head Office IT staff can edit all locations
 * Regional IT heads can edit their own location's data
 * Other users can only edit their own location's data
 */
export function canEditLocation(user: User | null, location: string): boolean {
  if (!user) return false
  if (canSeeAllLocations(user)) return true
  if (user.role === "regional_it_head" && locationsMatch(user.location, location)) return true
  return locationsMatch(user.location, location)
}

/**
 * Checks if a user can create IT repair tasks
 * Admins, IT staff, Head Office IT leads, and Regional IT heads can create repairs
 * Other staff can only view repairs
 */
export function canCreateRepairs(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  if (user.role === "regional_it_head") return true
  if (user.role === "it_staff") return true
  if (user.role === "it_head" && locationsMatch(user.location, "Head Office")) return true
  if (user.role === "it_store_head" && locationsMatch(user.location, "Head Office")) return true
  return false
}

/**
 * Checks if a user can edit/delete stock items
 * Admin and IT Store Head can edit/delete all stock
 * IT Head at Head Office can also manage stock
 * Regional IT Heads can manage stock in their location
 */
export function canManageStock(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  if (user.role === "it_store_head") return true
  if (user.role === "it_head" && locationsMatch(user.location, "Head Office")) return true
  if (user.role === "regional_it_head") return true
  return false
}

/**
 * Checks if a user can assign items to users in their location
 * Regional IT heads can assign items in their location
 */
export function canAssignItems(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  if (user.role === "it_head") return true
  if (user.role === "regional_it_head") return true
  if (user.role === "it_store_head") return true
  return false
}

/**
 * Checks if a user can view stock balance reports
 * All IT staff roles can view stock reports, except regular users
 */
export function canViewStockReports(user: User | null): boolean {
  if (!user) return false
  const allowedRoles = ["admin", "it_head", "regional_it_head", "it_staff", "it_store_head"]
  return allowedRoles.includes(user.role)
}
