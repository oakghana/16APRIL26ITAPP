import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { recordTransaction } from "@/lib/transaction-utils"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

// Helper function to standardize location names to Title Case
function standardizeLocation(location: string | null | undefined): string {
  if (!location) return ""
  
  const locationMap: Record<string, string> = {
    "head_office": "Head Office",
    "central_stores": "Central Stores",
    "kumasi": "Kumasi",
    "takoradi": "Takoradi",
    "kaase": "Kaase",
    "tema": "Tema",
    "tarkwa": "Tarkwa",
  }
  
  const lowered = location.toLowerCase().replace(/\s+/g, '_')
  return locationMap[lowered] || location
}

export async function POST(request: Request) {
  try {
    const { requisitionId, recipientName, officeLocation, roomNumber, notes, location, items } = await request.json()

    console.log("[v0] Issuing requisition:", requisitionId, "to:", recipientName || "N/A")

    // Validate required fields - only requisitionId is required
    if (!requisitionId) {
      return NextResponse.json(
        { error: "Requisition ID is required" },
        { status: 400 }
      )
    }

    // Use defaults for optional fields
    const effectiveRecipient = recipientName?.trim() || "Stock Issue"
    const effectiveOfficeLocation = officeLocation?.trim() || "N/A"
    const effectiveRoomNumber = roomNumber?.trim() || ""

    // Get requisition details
    const { data: requisition, error: reqError } = await supabaseAdmin
      .from("store_requisitions")
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (reqError || !requisition) {
      console.error("[v0] Requisition not found:", reqError)
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 })
    }

    const requisitionItems = items || requisition.items || []
    const sourceLocation = standardizeLocation(location || requisition.location)
    const destinationLocation = standardizeLocation(requisition.destination_location)

    console.log("[v0] Processing requisition - Source:", sourceLocation, "Destination:", destinationLocation)

    // Process each item
    for (const item of requisitionItems) {
      const itemName = item.itemName || item.item_name || item.name
      
      if (!itemName) {
        console.warn("[v0] Skipping item without name:", item)
        continue
      }

      // Normalize location for search - handle both "central_stores" and "Central Stores" formats
      const normalizedLocation = location?.replace(/_/g, ' ')
      const locationVariants = [location, normalizedLocation, "Central Stores", "central_stores"]
        .filter((v, i, arr) => v && arr.indexOf(v) === i) // Remove duplicates and nulls

      console.log("[v0] Searching for item:", itemName, "at locations:", locationVariants)

      // Get current stock level - search by name at the specified location
      // First try by item_id if available, then fall back to name search
      let currentItem = null
      let fetchError = null

      // Strategy 1: Try to find by item_id first (exact match regardless of location)
      if (item.item_id) {
        const result = await supabaseAdmin
          .from("store_items")
          .select("*")
          .eq("id", item.item_id)
          .single()
        
        if (result.data && result.data.quantity > 0) {
          currentItem = result.data
          console.log("[v0] Found item by ID:", item.item_id, "at location:", result.data.location, "quantity:", result.data.quantity)
        }
        fetchError = result.error
      }

      // Strategy 2: Search by name at location variants
      if (!currentItem) {
        console.log("[v0] Item not found by ID, searching by name:", itemName)
        for (const loc of locationVariants) {
          const result = await supabaseAdmin
            .from("store_items")
            .select("*")
            .ilike("name", itemName)
            .ilike("location", `%${loc.replace(/[_\s]/g, '%')}%`)
            .gt("quantity", 0)
            .order("quantity", { ascending: false })
            .limit(1)
            .single()
          
          if (result.data) {
            currentItem = result.data
            console.log("[v0] Found item by name at location:", loc, "quantity:", result.data.quantity)
            break
          }
          fetchError = result.error
        }
      }

      // Strategy 3: Search globally for any stock of this item
      if (!currentItem) {
        console.log("[v0] Searching globally for:", itemName)
        const result = await supabaseAdmin
          .from("store_items")
          .select("*")
          .ilike("name", itemName)
          .gt("quantity", 0)
          .order("quantity", { ascending: false })
          .limit(1)
          .single()
        
        if (result.data) {
          currentItem = result.data
          console.log("[v0] Found item globally at:", result.data.location, "quantity:", result.data.quantity)
        }
        fetchError = result.error
      }

      if (!currentItem) {
        console.error("[v0] Error fetching item:", itemName, "- not found anywhere with stock > 0", fetchError)
        return NextResponse.json(
          { error: `Item ${itemName} not found in stock at ${location} or any location` },
          { status: 404 }
        )
      }

      const newQuantity = currentItem.quantity - item.quantity

      if (newQuantity < 0) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${itemName}. Available: ${currentItem.quantity}, Required: ${item.quantity}`,
          },
          { status: 400 }
        )
      }

      // Handle stock transfer between locations
      if (destinationLocation && destinationLocation !== sourceLocation) {
        console.log(`[v0] Processing stock transfer from ${sourceLocation} to ${destinationLocation}`)
        
        // Update source location (deduct stock)
        const { error: sourceUpdateError } = await supabaseAdmin
          .from("store_items")
          .update({
            quantity: newQuantity,
            quantity_in_stock: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentItem.id)

        if (sourceUpdateError) {
          console.error("[v0] Error updating source stock:", sourceUpdateError)
          return NextResponse.json(
            { error: `Failed to update stock at source location for ${item.itemName}` },
            { status: 500 }
          )
        }

        // Check if item exists at destination location
        const { data: destinationItem, error: destFetchError } = await supabaseAdmin
          .from("store_items")
          .select("*")
          .eq("name", currentItem.name)
          .eq("location", destinationLocation)
          .single()

        if (destFetchError && destFetchError.code !== 'PGRST116') {
          console.error("[v0] Error checking destination item:", destFetchError)
          return NextResponse.json(
            { error: `Failed to check destination stock for ${item.itemName}` },
            { status: 500 }
          )
        }

        if (destinationItem) {
          // Update existing item at destination
          const { error: destUpdateError } = await supabaseAdmin
            .from("store_items")
            .update({
              quantity: destinationItem.quantity + item.quantity,
              quantity_in_stock: (destinationItem.quantity_in_stock || 0) + item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq("id", destinationItem.id)

          if (destUpdateError) {
            console.error("[v0] Error updating destination stock:", destUpdateError)
            return NextResponse.json(
              { error: `Failed to update destination stock for ${itemName}` },
              { status: 500 }
            )
          }
          
          console.log(`[v0] Updated destination stock for ${itemName}: ${destinationItem.quantity} -> ${destinationItem.quantity + item.quantity}`)
        } else {
          // Create new item at destination location
          // Generate a unique SIV number for the new item
          const sivNumber = `SIV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
          const newSku = currentItem.sku ? `${currentItem.sku}-${destinationLocation.substring(0, 3).toUpperCase()}` : `SKU-${Date.now()}`
          
          const { error: destCreateError } = await supabaseAdmin
            .from("store_items")
            .insert({
              name: currentItem.name,
              description: currentItem.description,
              category: currentItem.category,
              sku: newSku,
              siv_number: sivNumber,
              quantity: item.quantity,
              quantity_in_stock: item.quantity,
              unit: currentItem.unit || 'pieces',
              unit_price: currentItem.unit_price,
              location: destinationLocation,
              supplier: currentItem.supplier || 'N/A',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (destCreateError) {
            console.error("[v0] Error creating destination item:", destCreateError)
            return NextResponse.json(
              { error: `Failed to create item at destination for ${itemName}: ${destCreateError.message}` },
              { status: 500 }
            )
          }
          
          console.log(`[v0] Created new item at destination for ${item.itemName}: quantity ${item.quantity}`)
        }

        console.log(`[v0] Stock transfer completed for ${item.itemName}: ${sourceLocation} (-${item.quantity}) -> ${destinationLocation} (+${item.quantity})`)
      } else {
        // Standard stock reduction for same location
        const { error: updateError } = await supabaseAdmin
          .from("store_items")
          .update({
            quantity: newQuantity,
            quantity_in_stock: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentItem.id)

        if (updateError) {
          console.error("[v0] Error updating stock for", itemName, ":", updateError)
          return NextResponse.json(
            { error: `Failed to update stock for ${itemName}` },
            { status: 500 }
          )
        }

        console.log(`[v0] Stock reduced for ${itemName}: ${currentItem.quantity} -> ${newQuantity}`)
      }

      // Create device entries for issued items
      // Only create device entries for actual hardware/equipment categories
      const deviceCategories = ["Computers", "Printers", "Network Equipment", "Peripherals", "Accessories"]
      const shouldCreateDevice = deviceCategories.some(cat => 
        currentItem.category?.toLowerCase().includes(cat.toLowerCase())
      )

      // Use destination location if transfer, otherwise use source location
      const effectiveLocation = destinationLocation || sourceLocation

      if (shouldCreateDevice) {
        // Create device entries for each quantity
        for (let i = 0; i < item.quantity; i++) {
          const serialNumber = `${currentItem.sku || currentItem.name.substring(0, 3).toUpperCase()}-${Date.now()}-${i + 1}`
          
          const { data: newDevice, error: deviceError } = await supabaseAdmin.from("devices").insert({
            device_type: currentItem.category || "Other",
            brand: currentItem.name.split(" ")[0] || "Generic",
            model: currentItem.name,
            serial_number: serialNumber,
            status: "in_use",
            location: effectiveLocation,
            assigned_to: effectiveRecipient,
            office_location: effectiveOfficeLocation,
            room_number: effectiveRoomNumber,
            notes: `Issued via requisition ${requisition.requisition_number}${destinationLocation ? ` (transferred from ${sourceLocation} to ${destinationLocation})` : ''}. ${notes || ""}`.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select().single()

          if (deviceError) {
            console.error("[v0] Error creating device entry:", deviceError)
          } else {
            console.log(`[v0] Created device entry for ${itemName} - ${serialNumber}`)
            
            // Create stock assignment record
            await supabaseAdmin.from("stock_assignments").insert({
              item_id: currentItem.id,
              device_id: newDevice?.id,
              item_name: itemName,
              quantity: 1,
              assigned_to: effectiveRecipient,
              office_location: effectiveOfficeLocation,
              room_number: effectiveRoomNumber,
              location: effectiveLocation,
              status: "assigned",
              assigned_by: "Store Manager",
              notes: `Issued via ${requisition.requisition_number}${destinationLocation ? ` (transferred from ${sourceLocation})` : ''}`,
              created_at: new Date().toISOString(),
            })
          }
        }
      } else {
        // For non-device items, just create assignment record
        await supabaseAdmin.from("stock_assignments").insert({
          item_id: currentItem.id,
          item_name: itemName,
          quantity: item.quantity,
          assigned_to: effectiveRecipient,
          office_location: effectiveOfficeLocation,
          room_number: effectiveRoomNumber,
          location: effectiveLocation,
          status: "assigned",
          assigned_by: "Store Manager",
          notes: `Issued via ${requisition.requisition_number}${destinationLocation ? ` (transferred from ${sourceLocation})` : ''}`,
          created_at: new Date().toISOString(),
        })
      }

      // Record stock transaction using the database function
      const { data: recordedTransactionId, error: transactionError } = await supabaseAdmin.rpc('record_stock_transaction', {
        p_item_id: currentItem.id,
        p_transaction_type: 'issue',
        p_quantity: item.quantity,
        p_location: effectiveLocation,
        p_recipient: effectiveRecipient,
        p_office_location: effectiveOfficeLocation,
        p_room_number: effectiveRoomNumber || null,
        p_reference_type: 'requisition',
        p_reference_id: requisitionId,
        p_reference_number: requisition.requisition_number,
        p_notes: notes || `Issued via ${requisition.requisition_number}${destinationLocation ? ` (transferred from ${sourceLocation})` : ''}`,
        p_performed_by: "Store Manager"
      })

      if (transactionError) {
        console.warn("[v0] Could not record transaction via function, using direct insert:", transactionError)
        // Fallback to direct insert using normalized helper
        await recordTransaction(supabaseAdmin, {
          item_id: currentItem.id,
          item_name: itemName,
          transaction_type: "issue",
          quantity: item.quantity,
          unit: item.unit || currentItem.unit,
          location_name: effectiveLocation,
          recipient: effectiveRecipient,
          office_location: effectiveOfficeLocation,
          room_number: effectiveRoomNumber,
          reference_type: 'requisition',
          reference_id: requisitionId,
          reference_number: requisition.requisition_number,
          quantity_before: currentItem.quantity,
          quantity_after: newQuantity,
          notes: notes || `Issued via ${requisition.requisition_number}${destinationLocation ? ` (transferred from ${sourceLocation})` : ''}`,
          performed_by: "Store Manager",
        })
      } else if (recordedTransactionId) {
        const { error: balanceError } = await supabaseAdmin
          .from("stock_transactions")
          .update({ quantity_before: currentItem.quantity, quantity_after: newQuantity })
          .eq("id", recordedTransactionId)

        if (balanceError) {
          console.warn("[v0] Could not store stock balance on issue transaction:", balanceError)
        }
      }
    }

    // Update requisition status to issued
    const { error: updateReqError } = await supabaseAdmin
      .from("store_requisitions")
      .update({
        status: "issued",
        issued_at: new Date().toISOString(),
        notes: notes || (effectiveRecipient !== "Stock Issue" ? `Issued to ${effectiveRecipient}${effectiveOfficeLocation !== "N/A" ? ` at ${effectiveOfficeLocation}` : ''}${effectiveRoomNumber ? `, Room ${effectiveRoomNumber}` : ''}` : 'Items issued'),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requisitionId)

    if (updateReqError) {
      console.error("[v0] Error updating requisition status:", updateReqError)
      // Don't fail the whole operation - items were already issued
      console.warn("[v0] Items issued successfully but requisition status update failed")
    }

    console.log("[v0] Requisition issued successfully:", requisitionId)

    return NextResponse.json({
      success: true,
      message: "Items issued successfully. Stock deducted and devices created.",
      requisitionId,
    })
  } catch (error: any) {
    console.error("[v0] Error in issue-requisition route:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
