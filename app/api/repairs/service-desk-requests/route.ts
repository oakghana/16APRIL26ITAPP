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
    const { searchParams } = req.nextUrl
    const isDepartmentView = searchParams.get('department') === 'true'
    const userId = searchParams.get('userId')

    if (!isDepartmentView) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const { data: headData, error: headError } = await supabase
      .from('profiles')
      .select('id, location')
      .eq('id', userId)
      .single()

    if (headError || !headData) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    let query = supabase
      .from('service_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if ((headData.location || '').trim()) {
      const clause = buildLocationOrClause(headData.location)
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

    const requests = (data || []).map((ticket: any) => ({
      id: ticket.id,
      task_number: ticket.ticket_number || ticket.id,
      device_name: ticket.title || 'Service Request',
      issue_description: ticket.description || '',
      priority: ticket.priority || 'medium',
      status: ticket.status || 'open',
      assigned_to: ticket.assigned_to || null,
      created_at: ticket.created_at,
    }))

    return NextResponse.json({
      success: true,
      requests,
    })
  } catch (err) {
    console.error('[v0] Service desk requests API error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service desk requests' },
      { status: 500 }
    )
  }
}
