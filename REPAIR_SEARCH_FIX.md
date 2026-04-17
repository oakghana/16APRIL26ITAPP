# Repair Search Location Filtering Fix

## Issue
Repair search/lookup dropdown was showing devices from all locations for Regional IT Heads and IT Staff users, instead of restricting to only devices in their assigned location.

## Solution Implemented

### File Modified
- **components/repairs/it-head-repair-management.tsx**

### Changes Made

#### Device Filtering Enhancement (Line 420-443)
Updated the `filteredDevices` logic to include location-based filtering in addition to the existing search functionality:

```typescript
// Filter devices based on search term and location restriction
const filteredDevices = devices.filter((device) => {
  const search = deviceSearchTerm.toLowerCase()
  
  // Search filter
  const matchesSearch = (
    device.assetTag?.toLowerCase().includes(search) ||
    device.serialNumber?.toLowerCase().includes(search) ||
    device.brand?.toLowerCase().includes(search) ||
    device.model?.toLowerCase().includes(search) ||
    device.type?.toLowerCase().includes(search)
  )
  
  // Location filter - for regional IT heads and IT staff, only show devices from their location
  let matchesLocation = true
  if ((isRegionalITHead || user?.role === "it_staff") && user?.location) {
    const userLocationNorm = normalizeLocation(user.location)
    const deviceLocationNorm = normalizeLocation(device.location)
    matchesLocation = userLocationNorm === deviceLocationNorm || 
                     deviceLocationNorm.includes(userLocationNorm) || 
                     userLocationNorm.includes(deviceLocationNorm)
  }
  
  return matchesSearch && matchesLocation
})
```

### How It Works

1. **Role-Based Filtering**: 
   - Admins and IT Heads can see all devices (no location restriction)
   - Regional IT Heads (role: `regional_it_head`) see only devices in their assigned location
   - IT Staff (role: `it_staff`) see only devices in their assigned location

2. **Location Matching**:
   - Uses the existing `normalizeLocation()` utility function
   - Implements fuzzy location matching to handle variations in location names
   - Supports exact matches, substring matching, and partial keyword matching

3. **Search Integration**:
   - Location filter works in combination with existing search functionality
   - Users can search for devices (by serial number, asset tag, brand, model, type)
   - Results are restricted to their location if they have a role restriction

### Existing Infrastructure Utilized

The fix leverages existing location management:
- **normalizeLocation()**: Converts location strings to normalized format for comparison
- **isRegionalITHead**: Variable already in component to check user role
- **user?.location**: User's assigned location already tracked in auth context
- **getLocationAliases()**: Available in location-filter.ts for future enhancement if needed

### User Experience Impact

- **Regional IT Heads**: Device dropdown now only shows devices from their assigned region
- **IT Staff**: Device dropdown only shows devices from their assigned location  
- **Admins/IT Heads**: Full device visibility maintained (no change)
- **Search**: Works as before but with location restriction applied

### Testing Checklist

- [ ] Regional IT Head can only see devices from their location in repair search
- [ ] IT Staff can only see devices from their location in repair search
- [ ] Admin users can see all devices (no location restriction)
- [ ] Device search still works correctly with location filter applied
- [ ] Location matching handles variant spellings (e.g., "Head Office" vs "head_office")
- [ ] Creating repair tasks works correctly with location-filtered devices

### Related Files

- `/api/repairs/route.ts` - API already has location filtering in GET method
- `/lib/location-filter.ts` - Utility functions for location matching
- `/lib/auth-context.tsx` - User location and role information
