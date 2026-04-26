import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { userId, full_name, phone, location, email } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Update user profile
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name,
        phone,
        location,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error('[v0] Error updating profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[v0] Profile updated for user ${userId}`)

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error: any) {
    console.error('[v0] Exception in profile update:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
