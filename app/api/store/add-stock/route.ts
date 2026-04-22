import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { recordTransaction } from "@/lib/transaction-utils"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

/**
 * Normalize category name to title case format (server-side version)
 */
function normalizeCategoryName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return ""
  
  try {
    return name
      .toLowerCase()
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  } catch (error) {
    console.warn("[v0] Error normalizing category name:", error, name)
    return String(name)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      description, 
      category, 
      sku, 
      quantity, 
      unit_price, 
      unit,
      reorder_level,
      location, 
      supplier, 
      user_id, 
      user_role,
      notes,
      // New fields for the AddStockToCentralStore component
      isNewItem,
      itemId,
      addedBy,
      addedByRole
    } = body

    // Support both old and new parameter names
    const effectiveUserRole = user_role || addedByRole
    const effectiveUserId = user_id || addedBy

    console.log("[v0] Add stock request:", { name, category, quantity, location, user_role: effectiveUserRole, isNewItem, itemId })

    // Authorization check - only admin and it_store_head can add stock
    if (!effectiveUserRole || !["admin", "it_store_head"].includes(effectiveUserRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Only Admin and IT Store Head can add stock items." },
        { status: 403 }
      )
    }

    // If adding to existing item by ID
    if (!isNewItem && itemId) {
      // Fetch the existing item by ID
      const { data: existingItem, error: fetchError } = await supabaseAdmin
        .from("store_items")
        .select("*")
        .eq("id", itemId)
        .single()

      if (fetchError || !existingItem) {
        console.error("[v0] Error fetching item by ID:", fetchError)
        return NextResponse.json(
          { error: "Item not found" },
          { status: 404 }
        )
      }

      // Update existing item quantity
      const newQuantity = existingItem.quantity + parseInt(quantity)
      const newStockQuantity = (existingItem.quantity_in_stock || 0) + parseInt(quantity)

      const { error: updateError } = await supabaseAdmin
        .from("store_items")
        .update({
          quantity: newQuantity,
          quantity_in_stock: newStockQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingItem.id)

      if (updateError) {
        console.error("[v0] Error updating existing item:", updateError)
        return NextResponse.json(
          { error: "Failed to update existing item stock" },
          { status: 500 }
        )
      }

      // Record stock addition transaction
      try {
        const transactionData: Record<string, any> = {
          item_id: existingItem.id,
          item_name: existingItem.name,
          transaction_type: "addition",
          quantity: parseInt(quantity),
          unit: existingItem.unit || "pcs",
          location_name: existingItem.location,
          reference_type: "stock_addition",
          reference_number: `ADD-${Date.now()}`,
          notes: notes || `Stock addition: +${quantity} items added by ${effectiveUserRole}`,
          created_at: new Date().toISOString(),
        }

        await recordTransaction(supabaseAdmin, transactionData)
      } catch (txErr) {
        console.warn("[v0] Transaction recording skipped:", txErr)
      }

      console.log(`[v0] Updated existing item stock: ${existingItem.quantity} -> ${newQuantity}`)
      
      return NextResponse.json({
        message: "Stock updated successfully",
        item: {
          id: existingItem.id,
          name: existingItem.name,
          previous_quantity: existingItem.quantity,
          new_quantity: newQuantity,
          added_quantity: parseInt(quantity),
          location: existingItem.location
        }
      })
    }

    // Creating new item or adding by name matching (original flow)
    // Validate required fields for new items
    if (!name || !category || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields: name, category, quantity" },
        { status: 400 }
      )
    }

    // Force location to always be "Central Stores" for admin/it_store_head
    const forcedLocation = "Central Stores"

    // Normalize category name for consistency
    const normalizedCategory = normalizeCategoryName(category)

    // Check if item already exists at this location by name
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from("store_items")
      .select("*")
      .eq("name", name)
      .eq("location", forcedLocation)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("[v0] Error checking existing item:", fetchError)
      return NextResponse.json(
        { error: "Failed to check existing items" },
        { status: 500 }
      )
    }

    if (existingItem && !isNewItem) {
      // Update existing item quantity (found by name match)
      const newQuantity = existingItem.quantity + parseInt(quantity)
      const newStockQuantity = (existingItem.quantity_in_stock || 0) + parseInt(quantity)

      const { error: updateError } = await supabaseAdmin
        .from("store_items")
        .update({
          quantity: newQuantity,
          quantity_in_stock: newStockQuantity,
          cost_price: unit_price || existingItem.cost_price,
          supplier: supplier || existingItem.supplier,
          notes: notes || existingItem.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingItem.id)

      if (updateError) {
        console.error("[v0] Error updating existing item:", updateError)
        return NextResponse.json(
          { error: "Failed to update existing item stock" },
          { status: 500 }
        )
      }

      // Record stock addition transaction
      try {
        const transactionData: Record<string, any> = {
          item_id: existingItem.id,
          item_name: name,
          transaction_type: "addition",
          quantity: parseInt(quantity),
          unit: unit || "pcs",
          location_name: location,
          reference_type: "stock_addition",
          reference_number: `ADD-${Date.now()}`,
          notes: notes || `Stock addition: +${quantity} items added by ${effectiveUserRole}`,
          created_at: new Date().toISOString(),
        }

        await recordTransaction(supabaseAdmin, transactionData)
      } catch (txErr) {
        console.warn("[v0] Transaction recording skipped:", txErr)
      }

      console.log(`[v0] Updated existing item stock: ${existingItem.quantity} -> ${newQuantity}`)
      
      return NextResponse.json({
        message: "Stock updated successfully",
        item: {
          id: existingItem.id,
          name,
          previous_quantity: existingItem.quantity,
          new_quantity: newQuantity,
          added_quantity: parseInt(quantity),
          location: forcedLocation
        }
      })
    } else {
      // Create new item
      // Generate a unique SIV number (Stock Item Voucher)
      const sivNumber = `SIV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`
      
      const { data: newItem, error: insertError } = await supabaseAdmin
        .from("store_items")
        .insert({
          name,
          category: normalizedCategory,
          sku: sku || `SKU-${Date.now()}`,
          siv_number: sivNumber,
          quantity: parseInt(quantity),
          quantity_in_stock: parseInt(quantity),
          unit: unit || "pcs",
          reorder_level: reorder_level ? parseInt(reorder_level) : 5,
          location: forcedLocation,
          supplier: supplier || "",
          notes: notes || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.error("[v0] Error creating new item:", insertError)
        return NextResponse.json(
          { error: insertError.message || "Failed to create new stock item" },
          { status: 500 }
        )
      }

      // Record stock addition transaction for new item
      try {
        const transactionData: Record<string, any> = {
          item_id: newItem.id,
          item_name: name,
          transaction_type: "addition",
          quantity: parseInt(quantity),
          unit: unit || "pcs",
          location_name: forcedLocation,
          reference_type: "stock_addition",
          reference_number: `ADD-${Date.now()}`,
          notes: notes || `New item added: ${quantity} items by ${effectiveUserRole}`,
          created_at: new Date().toISOString(),
        }

        await recordTransaction(supabaseAdmin, transactionData)
      } catch (txErr) {
        console.warn("[v0] Transaction recording skipped:", txErr)
      }

      console.log(`[v0] Created new item with ${quantity} stock`)
      
      return NextResponse.json({
        message: "New stock item created successfully",
        item: {
          id: newItem.id,
          name,
          quantity: parseInt(quantity),
          location: forcedLocation,
          category
        }
      })
    }

  } catch (error: any) {
    console.error("[v0] Error in add-stock API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
