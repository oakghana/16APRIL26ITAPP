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
- **Admin** - Full access to upload documents
- **IT Head** - Full access to upload documents
- **Regional IT Head** - Can upload documents for their region
- **IT Staff (Non-Head Office)** - Can upload documents if located at any branch/location except "Head Office"

### ❌ Cannot Upload Documents:
- **IT Staff at Head Office** - Restricted from uploading (contact IT Head)
- **Service Desk Staff** - No upload permissions
- **Other users** - No upload permissions

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
// Frontend Permission Check
canUpload = 
  - isAdmin OR
  - isITHead OR 
  - isRegionalITHead OR
  - (isITStaff AND userLocation does NOT contain "head")
```

## User Experience

### For Non-Head Office IT Staff:
1. Upload button is **visible and enabled**
2. Can select document type (Toner Report, Quarterly Report, Information)
3. Can set target location for the document
4. Upload processed immediately upon confirmation

### For Head Office IT Staff:
1. Upload button is **hidden**
2. Informational message displayed: "To upload documents, please contact your IT Head or Regional IT Head."
3. Can still view and manage all documents

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

### Test Case 1: Non-Head Office IT Staff
- Login as IT Staff from "Kumasi Branch"
- Navigate to IT Documents & Reports
- ✅ Upload button should be visible
- Upload a test document
- ✅ Document upload should succeed

### Test Case 2: Head Office IT Staff
- Login as IT Staff from "Head Office"
- Navigate to IT Documents & Reports
- ❌ Upload button should be hidden
- Message should display about contacting IT Head
- ✅ Can still view all documents

### Test Case 3: Admin User
- Login as Admin
- ✅ Upload button should be visible
- Can upload documents as before

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
