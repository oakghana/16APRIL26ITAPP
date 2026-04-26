import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Profile details are managed by admin. Use Change Password for self-service.' },
      { status: 403 }
    )
  } catch (error: any) {
    console.error('[v0] Exception in profile update:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
