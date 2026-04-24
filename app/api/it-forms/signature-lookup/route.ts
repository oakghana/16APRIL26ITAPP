import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-build-key"
)

type LookupBody = {
  hodName?: string
  managerName?: string
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function buildCandidatePatterns(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) return []
  const parts = trimmed.split(" ").filter(Boolean)
  const patterns = new Set<string>()
  patterns.add(trimmed)
  patterns.add(`%${trimmed}%`)
  if (parts.length > 1) {
    patterns.add(parts[0])
    patterns.add(`%${parts[0]}%`)
    patterns.add(parts[parts.length - 1])
    patterns.add(`%${parts[parts.length - 1]}%`)
  }
  return Array.from(patterns)
}

async function resolveSignatureByName(name: string, roles: string[]) {
  const normalized = name.trim()
  if (!normalized) return null

  const targetNormalized = normalizeName(normalized)
  const patterns = buildCandidatePatterns(normalized)
  const candidates: Array<{ id: string; full_name?: string | null; username?: string | null }> = []

  for (const pattern of patterns) {
    const { data: byFullName } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, username")
      .ilike("full_name", pattern)
      .limit(20)

    const { data: byUsername } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, username")
      .ilike("username", pattern)
      .limit(20)

    candidates.push(...(byFullName || []), ...(byUsername || []))
  }

  const ranked = Array.from(
    new Map(candidates.map((item) => [item.id, item])).values()
  ).sort((a, b) => {
    const aFull = normalizeName(a.full_name || "")
    const bFull = normalizeName(b.full_name || "")
    const aUser = normalizeName(a.username || "")
    const bUser = normalizeName(b.username || "")
    const aScore = (aFull === targetNormalized ? 2 : 0) + (aUser === targetNormalized ? 1 : 0)
    const bScore = (bFull === targetNormalized ? 2 : 0) + (bUser === targetNormalized ? 1 : 0)
    return bScore - aScore
  })

  const profileIds = ranked.map((p) => p.id).filter(Boolean)

  if (profileIds.length === 0) return null

  const { data: signatures } = await supabaseAdmin
    .from("it_form_signature_profiles")
    .select("signature_data_url, role, updated_at")
    .in("user_id", profileIds)
    .in("role", roles)
    .order("updated_at", { ascending: false })
    .limit(1)

  return signatures?.[0]?.signature_data_url || null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LookupBody

    const hodName = body.hodName?.trim() || ""
    const managerName = body.managerName?.trim() || ""

    const [hodSignature, managerSignature] = await Promise.all([
      hodName
        ? resolveSignatureByName(hodName, ["department_head", "admin"])
        : Promise.resolve(null),
      managerName
        ? resolveSignatureByName(managerName, ["it_head", "admin", "department_head", "regional_it_head"])
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      success: true,
      hodSignature,
      managerSignature,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
