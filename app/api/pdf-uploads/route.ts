import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { put } from "@vercel/blob"
import { logDocumentAudit } from "@/lib/audit-logging"
import { locationsMatch } from "@/lib/location-filter"

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const documentType = searchParams.get("type")
    const location = searchParams.get("location")
    const userRole = searchParams.get("userRole")
    const userLocation = searchParams.get("userLocation")
    const userId = searchParams.get("userId")

    console.log("[v0] PDF Uploads GET - type:", documentType, "location:", location, "userRole:", userRole, "userLocation:", userLocation, "userId:", userId)

    let query = supabase
      .from("pdf_uploads")
      .select(`
        *,
        confirmations:pdf_confirmations(
          id,
          user_id,
          user_name,
          user_location,
          confirmed_at,
          comments
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (documentType && documentType !== "all") {
      query = query.eq("document_type", documentType)
    }

    const { data, error } = await query

    console.log("[v0] PDF Uploads query result - count:", data?.length, "error:", error?.message)
    
    if (error) {
      console.error("[v0] Error fetching PDF uploads:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const canSeeAllDocuments = userRole === "admin" || userRole === "it_head"

    const filteredUploads = (data || []).filter((upload: any) => {
      const matchesRequestedLocation =
        !location ||
        location === "all" ||
        !upload.target_location ||
        locationsMatch(upload.target_location, location)

      if (!matchesRequestedLocation) return false

      if (canSeeAllDocuments) {
        return true
      }

      const matchesUserLocation =
        !upload.target_location ||
        (userLocation ? locationsMatch(upload.target_location, userLocation) : false)

      if (!matchesUserLocation) return false

      const isPublished = Boolean(upload.is_confirmed)
      const isOwnUpload = Boolean(userId && upload.uploaded_by === userId)
      const isLocationSpecificDocument = Boolean(upload.target_location)

      if (isLocationSpecificDocument) {
        return true
      }

      return isPublished || isOwnUpload
    })

    return NextResponse.json({ success: true, uploads: filteredUploads })
  } catch (error) {
    console.error("[v0] Error in GET /api/pdf-uploads:", error)
    return NextResponse.json({ error: "Failed to fetch PDF uploads" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const formData = await request.formData()
    const file = formData.get("file") as File
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const documentType = formData.get("documentType") as string
    const targetLocation = formData.get("targetLocation") as string
    const uploadedBy = formData.get("uploadedBy") as string
    const uploadedByName = formData.get("uploadedByName") as string
    const userRole = formData.get("userRole") as string
    const userLocation = formData.get("userLocation") as string

    console.log("[v0] PDF Upload POST - Received form data:", {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      title,
      documentType,
      uploadedBy,
      uploadedByName,
      userRole,
      userLocation,
    })

    if (!file || !title || !documentType || !uploadedBy || !uploadedByName) {
      console.log("[v0] Missing required fields:", {
        file: !!file,
        title: !!title,
        documentType: !!documentType,
        uploadedBy: !!uploadedBy,
        uploadedByName: !!uploadedByName,
      })
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (file.type && file.type !== "application/pdf") {
      console.log("[v0] Invalid file type:", file.type)
      return NextResponse.json(
        { error: "Only PDF documents can be uploaded" },
        { status: 400 }
      )
    }

    // Validate upload permissions
    const isAdmin = userRole === "admin"
    const isITHead = userRole === "it_head"
    const isRegionalITHead = userRole === "regional_it_head"
    const isAllowedITStaffUploader =
      userRole === "it_staff" &&
      userLocation &&
      locationsMatch(userLocation, "Head Office")

    const canUploadDocument = isAdmin || isITHead || isRegionalITHead || isAllowedITStaffUploader

    console.log("[v0] Upload permission check:", {
      isAdmin,
      isITHead,
      isRegionalITHead,
      isAllowedITStaffUploader,
      canUploadDocument,
    })

    if (!canUploadDocument) {
      console.warn(
        `[v0] Upload rejected - insufficient permissions. Role: ${userRole}, Location: ${userLocation}`
      )
      return NextResponse.json(
        { error: "You do not have permission to upload documents. Only Admin, IT Head, Regional IT Head, and IT Staff at Head Office can upload." },
        { status: 403 }
      )
    }

    // Upload file to Vercel Blob
    const fileName = `pdf-documents/${Date.now()}_${file.name.replace(/\s+/g, "_")}`
    let url: string

    try {
      const blob = await put(fileName, file, {
        access: "public",
        contentType: file.type || "application/pdf",
      })

      url = blob.url
    } catch (blobError) {
      console.error("[v0] Error uploading PDF to Vercel Blob:", blobError)

      const message = blobError instanceof Error ? blobError.message : "Unknown blob upload error"
      const isBlobConfigError = message.toLowerCase().includes("token") || message.toLowerCase().includes("blob")

      return NextResponse.json(
        {
          error: isBlobConfigError
            ? "Document storage is not configured correctly. Please set the Vercel Blob token and try again."
            : message,
        },
        { status: 500 }
      )
    }

    console.log("[v0] File uploaded to Vercel Blob successfully:", url)

    const effectiveTargetLocation = isAdmin || isITHead
      ? targetLocation === "all"
        ? null
        : targetLocation
      : userLocation || null

    // Create database record
    console.log("[v0] Attempting to insert PDF upload record with data:", {
      title,
      description,
      document_type: documentType,
      file_name: file.name,
      file_url: url,
      file_size: file.size,
      uploaded_by: uploadedBy,
      uploaded_by_name: uploadedByName,
      target_location: effectiveTargetLocation,
      is_active: true,
    })

    const { data, error } = await supabase
      .from("pdf_uploads")
      .insert({
        title,
        description,
        document_type: documentType,
        file_name: file.name,
        file_url: url,
        file_size: file.size,
        uploaded_by: uploadedBy,
        uploaded_by_name: uploadedByName,
        target_location: effectiveTargetLocation,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating PDF upload record:", error)
      console.error("[v0] Error details:", { code: error.code, message: error.message, details: error.details })
      return NextResponse.json({ 
        error: `Failed to create PDF upload: ${error.message}`,
        details: error.details 
      }, { status: 500 })
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF documents can be uploaded" },
        { status: 400 }
      )
    }

    // Validate upload permissions
    const isAdmin = userRole === "admin"
    const isITHead = userRole === "it_head"
    const isRegionalITHead = userRole === "regional_it_head"
    const isAllowedITStaffUploader =
      userRole === "it_staff" &&
      userLocation &&
      locationsMatch(userLocation, "Head Office")

    const canUploadDocument = isAdmin || isITHead || isRegionalITHead || isAllowedITStaffUploader

    if (!canUploadDocument) {
      console.warn(
        `[v0] Upload rejected - insufficient permissions. Role: ${userRole}, Location: ${userLocation}`
      )
      return NextResponse.json(
        { error: "You do not have permission to upload documents. Only Admin, IT Head, Regional IT Head, and IT Staff at Head Office or Accra can upload." },
        { status: 403 }
      )
    }

    // Upload file to Vercel Blob
    const fileName = `pdf-documents/${Date.now()}_${file.name.replace(/\s+/g, "_")}`
    let url: string

    try {
      const blob = await put(fileName, file, {
        access: "public",
        contentType: file.type || "application/pdf",
      })

      url = blob.url
    } catch (blobError) {
      console.error("[v0] Error uploading PDF to Vercel Blob:", blobError)

      const message = blobError instanceof Error ? blobError.message : "Unknown blob upload error"
      const isBlobConfigError = message.toLowerCase().includes("token") || message.toLowerCase().includes("blob")

      return NextResponse.json(
        {
          error: isBlobConfigError
            ? "Document storage is not configured correctly. Please set the Vercel Blob token and try again."
            : message,
        },
        { status: 500 }
      )
    }

    console.log("[v0] File uploaded to Vercel Blob successfully:", url)

    const effectiveTargetLocation = isAdmin || isITHead
      ? targetLocation === "all"
        ? null
        : targetLocation
      : userLocation || null

    // Create database record
    const { data, error } = await supabase
      .from("pdf_uploads")
      .insert({
        title,
        description,
        document_type: documentType,
        file_name: file.name,
        file_url: url,
        file_size: file.size,
        uploaded_by: uploadedBy,
        uploaded_by_name: uploadedByName,
        target_location: effectiveTargetLocation,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating PDF upload record:", error)
      console.error("[v0] Error details:", { code: error.code, message: error.message, details: error.details })
      return NextResponse.json({ 
        error: `Failed to create PDF upload: ${error.message}`,
        details: error.details 
      }, { status: 500 })
    }

    // Log audit trail for document upload
    await logDocumentAudit({
      document_id: data.id,
      action: "document_uploaded",
      user_id: uploadedBy,
      user_name: uploadedByName,
      details: {
        title,
        document_type: documentType,
        file_name: file.name,
        file_size: file.size,
        target_location: effectiveTargetLocation,
      },
    })

    return NextResponse.json({ success: true, upload: data })
  } catch (error) {
    console.error("Error in POST /api/pdf-uploads:", error)
    return NextResponse.json({ error: "Failed to create PDF upload" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const { id, title, description, documentType, targetLocation, userRole, userId, userName } = await request.json()

    if (!id || !title || !documentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["admin", "it_head"].includes(userRole)) {
      return NextResponse.json({ error: "You do not have permission to edit documents" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("pdf_uploads")
      .update({
        title,
        description,
        document_type: documentType,
        target_location: targetLocation === "all" ? null : targetLocation,
      })
      .eq("id", id)
      .eq("is_active", true)
      .select()
      .single()

    if (error) {
      console.error("Error updating PDF upload:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (userId && userName) {
      await logDocumentAudit({
        document_id: id,
        action: "document_updated",
        user_id: userId,
        user_name: userName,
        details: {
          title,
          document_type: documentType,
          target_location: targetLocation === "all" ? null : targetLocation,
        },
      })
    }

    return NextResponse.json({ success: true, upload: data })
  } catch (error) {
    console.error("Error in PATCH /api/pdf-uploads:", error)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const userId = searchParams.get("userId")
    const userName = searchParams.get("userName")

    if (!id) {
      return NextResponse.json({ error: "Missing upload ID" }, { status: 400 })
    }

    // Get the document details before deletion
    const { data: documentData, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError) {
      console.error("Error fetching document for audit:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from("pdf_uploads")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id)

    if (error) {
      console.error("Error deleting PDF upload:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log audit trail for document deletion
    if (userId && userName) {
      await logDocumentAudit({
        document_id: id,
        action: "document_deleted",
        user_id: userId,
        user_name: userName,
        details: {
          title: documentData.title,
          document_type: documentData.document_type,
          file_name: documentData.file_name,
          uploaded_by: documentData.uploaded_by,
          uploaded_by_name: documentData.uploaded_by_name,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/pdf-uploads:", error)
    return NextResponse.json({ error: "Failed to delete PDF upload" }, { status: 500 })
  }
}
