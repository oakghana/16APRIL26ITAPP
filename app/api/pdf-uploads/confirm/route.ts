import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: Request) {
  try {
    const { pdfId, userId, userName, userLocation, comments } = await request.json()

    if (!pdfId || !userId || !userName || !userLocation) {
      return NextResponse.json(
        { error: "Missing required fields: pdfId, userId, userName, userLocation" },
        { status: 400 }
      )
    }

    // Validate that the PDF exists
    const { data: pdfData, error: pdfError } = await supabase
      .from("pdf_uploads")
      .select("id")
      .eq("id", pdfId)
      .eq("is_active", true)
      .single()

    if (pdfError || !pdfData) {
      return NextResponse.json(
        { error: "Document not found or is no longer active" },
        { status: 404 }
      )
    }

    // Check if already confirmed
    const { data: existing } = await supabase
      .from("pdf_confirmations")
      .select("id")
      .eq("pdf_id", pdfId)
      .eq("user_id", userId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "You have already confirmed this document" },
        { status: 400 }
      )
    }

    // Create confirmation
    const { data, error } = await supabase
      .from("pdf_confirmations")
      .insert({
        pdf_id: pdfId,
        user_id: userId,
        user_name: userName,
        user_location: userLocation,
        comments: comments || "",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating confirmation:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, confirmation: data })
  } catch (error) {
    console.error("[v0] Error in POST /api/pdf-uploads/confirm:", error)
    return NextResponse.json({ error: "Failed to confirm document" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pdfId = searchParams.get("pdfId")

    if (!pdfId) {
      return NextResponse.json({ error: "Missing PDF ID" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("pdf_confirmations")
      .select("*")
      .eq("pdf_id", pdfId)
      .order("confirmed_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching confirmations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, confirmations: data || [] })
  } catch (error) {
    console.error("[v0] Error in GET /api/pdf-uploads/confirm:", error)
    return NextResponse.json({ error: "Failed to fetch confirmations" }, { status: 500 })
  }
}
