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
    let userLocation = ''

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('location')
        .eq('id', userId)
        .single()

      userLocation = profile?.location || ''
    }

    // Primary source: store_items (location-aware).
    let query = supabase
      .from('store_items')
      .select('*')
      .order('item_name', { ascending: true })

    if (userLocation.trim()) {
      const clause = buildLocationOrClause(userLocation)
      if (clause) {
        query = query.or(clause)
      }
    }

    const { data: storeItems, error: storeError } = await query

    if (!storeError && (storeItems?.length || 0) > 0) {
      return NextResponse.json({
        success: true,
        items: (storeItems || []).map((item: any) => ({
          ...item,
          unit: item.unit || 'pcs',
        })),
      })
    }

    // Fallback source: central_store_items if store_items is empty for this location.
    const { data: centralItems, error: centralError } = await supabase
      .from('central_store_items')
      .select('*')
      .order('item_name', { ascending: true })

    if (centralError) {
      return NextResponse.json(
        { success: false, error: centralError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      items: (centralItems || []).map((item: any) => ({
        ...item,
        unit: item.unit || 'pcs',
      })),
    })
  } catch (err) {
    console.error('[v0] Stock items API error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock items' },
      { status: 500 }
    )
  }
}
