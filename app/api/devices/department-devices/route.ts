import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLocationAliases } from '@/lib/location-filter'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function buildLocationOrClause(location: string) {
  const aliases = getLocationAliases(location)
  return aliases
    .map((alias) => alias.replace(/[,%()]/g, '').trim())
    .filter(Boolean)
    .map((alias) => `location.ilike.%${alias}%`)
    .join(',')
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Resolve department head profile from custom-auth user id.
    const { data: headData, error: headError } = await supabase
      .from('profiles')
      .select('id, location, department')
      .eq('id', userId)
      .single()

    if (headError || !headData) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const location = headData.location || ''

    let query = supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })

    if (location.trim()) {
      const clause = buildLocationOrClause(location)
      if (clause) {
        query = query.or(clause)
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const devices = (data || []).map((device: any) => ({
      ...device,
      device_name: device.device_name || `${device.brand || ''} ${device.model || ''}`.trim() || 'Unnamed Device',
    }))

    return NextResponse.json({
      success: true,
      devices,
    })
  } catch (err) {
    console.error('[v0] Department devices API error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch department devices' },
      { status: 500 }
    )
  }
}
