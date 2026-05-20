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

### ✅ Can Upload Documents:
- **Admin** - Full access to upload documents from any location
- **IT Head** - Full access to upload documents from any location
- **Regional IT Head** - Can upload documents from their region
- **IT Staff (ALL Locations)** - Can upload documents from any location (Kumasi, Accra, Takoradi, Tema, Sunyani, Cape Coast, etc.)

### ❌ Cannot Upload Documents:
- **Service Desk Staff** - No upload permissions
- **Other users** - No upload permissions

## Technical Implementation

### Frontend Changes
**File: `components/reports/pdf-uploads-dashboard.tsx`**
- Updated `canUpload` permission logic to allow ALL IT Staff to upload
- Removed "Head Office only" restriction
- Added enhanced upload success notifications with confirmation message
- Clear user feedback when document is uploaded and ready

### Backend Changes
**File: `app/api/pdf-uploads/route.ts`**
- Added server-side permission validation in POST handler
- Validates user role to allow all IT Staff regardless of location
- Returns 403 Forbidden if user lacks upload permissions
- Logs upload attempts for audit trail
- Improved error messages for non-authorized users

## Permission Logic (UPDATED)

```javascript
// Frontend Permission Check - SIMPLIFIED
canUpload = 
  - isAdmin OR
  - isITHead OR 
  - isRegionalITHead OR
  - isITStaff  // NOW: No location restriction!
```

## User Experience

### For ALL IT Staff (Regional or Head Office):
1. Upload button is **visible and enabled**
2. Can select document type (Toner Report, Quarterly Report, Information)
3. Can set target location for the document
4. Upload processed immediately with success confirmation
5. Document is immediately visible in the dashboard
6. Receive confirmation: "Document uploaded successfully! It's now visible to all IT staff."

### For Service Desk Staff or Others:
1. Upload button is **hidden**
2. Can still view all documents relevant to their location
3. Cannot upload or manage documents

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

### Test Case 1: Kumasi Branch IT Staff
- Login as IT Staff from "Kumasi Branch"
- Navigate to IT Documents & Reports
- ✅ Upload button should be visible and enabled
- ✅ Upload a test document successfully
- ✅ Document should appear in list immediately
- ✅ Other IT staff can see and download the document

### Test Case 2: Accra IT Staff
- Login as IT Staff from "Accra"
- Navigate to IT Documents & Reports
- ✅ Upload button should be visible and enabled
- ✅ Upload a test document successfully
- ✅ Document should appear in list immediately
- ✅ Can see all documents from all locations

### Test Case 3: Regional IT Head
- Login as Regional IT Head
- Navigate to IT Documents & Reports
- ✅ Upload button should be visible and enabled
- ✅ Upload documents for their region
- ✅ Documents visible to all IT staff

### Test Case 4: Admin User
- Login as Admin
- ✅ Upload button should be visible
- ✅ Can upload documents and set target locations
- ✅ Can see and manage all documents

### Test Case 5: Service Desk Staff
- Login as Service Desk Staff
- Navigate to IT Documents & Reports
- ❌ Upload button should NOT be visible
- ✅ Can still view documents relevant to their location

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
