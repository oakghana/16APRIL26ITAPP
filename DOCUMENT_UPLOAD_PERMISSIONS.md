# Document Upload Permissions - IT Documents & Reports

## Overview
This document outlines the permissions for viewing, downloading, and uploading documents in the IT Documents & Reports page.

## Who Can View and Download ALL Documents

### All IT Staff Roles Can View and Download ALL Documents:
- **Admin** - Full access to all documents
- **IT Head** - Full access to all documents
- **Regional IT Head** - Full access to all documents
- **IT Staff** - Full access to all documents
- **IT Store Head** - Full access to all documents
- **Service Desk Head** - Full access to all documents
- **Service Desk Staff (All Locations)** - Full access to all documents
  - service_desk_accra
  - service_desk_kumasi
  - service_desk_takoradi
  - service_desk_tema
  - service_desk_sunyani
  - service_desk_cape_coast

All IT staff can:
- View all documents from all locations
- Download all documents
- Filter documents by location
- Confirm document receipt

## Who Can Upload

### All IT Staff Roles Can Upload Documents:
- **Admin** - Full upload access
- **IT Head** - Full upload access
- **Regional IT Head** - Full upload access
- **IT Staff** - Full upload access (all locations)
- **IT Store Head** - Full upload access
- **Service Desk Head** - Full upload access
- **Service Desk Staff (All Locations)** - Full upload access
  - service_desk_accra
  - service_desk_kumasi
  - service_desk_takoradi
  - service_desk_tema
  - service_desk_sunyani
  - service_desk_cape_coast

All IT staff can upload documents with any attachment type they need to share across the organization.

## Technical Implementation

### Frontend Changes
**File: `components/reports/pdf-uploads-dashboard.tsx`**
- Updated `canUpload` permission logic to include IT Staff with location check
- Added user role and location context to upload API calls
- Added helpful message for IT Staff without upload permissions

### Backend Changes
**File: `app/api/pdf-uploads/route.ts`**
- Added server-side permission validation in POST handler
- Validates user role and location to prevent Head Office IT Staff from uploading
- Returns 403 Forbidden if user lacks upload permissions
- Logs warnings for unauthorized upload attempts

## Permission Logic

```javascript
// Upload Permission Check - All IT staff can upload
const itStaffRoles = [
  "admin",
  "it_head",
  "regional_it_head",
  "it_staff",
  "it_store_head",
  "service_desk_head",
  "service_desk_accra",
  "service_desk_kumasi",
  "service_desk_takoradi",
  "service_desk_tema",
  "service_desk_sunyani",
  "service_desk_cape_coast",
]

canUpload = itStaffRoles.includes(userRole)
```

## User Experience

### For All IT Staff:
1. Upload button is **visible and enabled**
2. Can select document type (Toner Report, Quarterly Report, Information)
3. Can set target location for the document
4. Upload any file attachment needed
5. Upload processed immediately upon confirmation

### For Non-IT Staff:
1. Upload button is **hidden**
2. Can still view documents available to their location

## Document Types
- **Toner Report** - Toner inventory and usage reports
- **Quarterly Report** - Quarterly IT reports and metrics
- **Information** - General IT information and announcements

## Audit Trail
All uploads are logged with:
- User ID and name
- Document details (title, type, size)
- Upload timestamp
- Target location (if specified)

## Testing Upload Permissions

### Test Case 1: IT Staff from Any Location
- Login as IT Staff from any location (Kumasi, Accra, etc.)
- Navigate to IT Documents & Reports
- ✅ Upload button should be visible
- Upload a test document
- ✅ Document upload should succeed

### Test Case 2: Service Desk Staff
- Login as Service Desk Staff
- Navigate to IT Documents & Reports
- ✅ Upload button should be visible
- Upload a test document
- ✅ Document upload should succeed

### Test Case 3: Admin User
- Login as Admin
- ✅ Upload button should be visible
- Can upload documents as before

### Test Case 4: Non-IT User
- Login as non-IT user
- ❌ Upload button should be hidden

## API Endpoints

### POST `/api/pdf-uploads`
- **Required Fields**: file, title, documentType, uploadedBy, uploadedByName, userRole, userLocation
- **Permission Check**: Validates user permissions before processing
- **Response**: 200 (success), 403 (forbidden), 400 (bad request), 500 (server error)

## Related Files
- `app/dashboard/it-documents/page.tsx` - Page access control
- `lib/location-filter.ts` - Location-based permission utilities
- `components/reports/pdf-uploads-dashboard.tsx` - Dashboard component
- `app/api/pdf-uploads/route.ts` - Upload API endpoint
