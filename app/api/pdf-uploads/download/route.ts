import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key",
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 })
    }

    const { data: document, error } = await supabase
      .from("pdf_uploads")
      .select("file_url, file_name, is_active")
      .eq("id", id)
      .single()

    if (error || !document || !document.is_active) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const fileResponse = await fetch(document.file_url)
    if (!fileResponse.ok || !fileResponse.body) {
      return NextResponse.json({ error: "Unable to retrieve document" }, { status: 502 })
    }

    const safeFileName = document.file_name.replace(/[\r\n"\\]/g, "_")

    return new Response(fileResponse.body, {
      headers: {
        "Content-Type": fileResponse.headers.get("content-type") || "application/pdf",
        "Content-Length": fileResponse.headers.get("content-length") || "",
        "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("[v0] Error downloading PDF document:", error)
    return NextResponse.json({ error: "Failed to download document" }, { status: 500 })
  }
}
