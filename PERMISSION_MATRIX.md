# IT Document Upload Permission Matrix

## Overview

This document shows the complete permission matrix for IT Document uploads after the latest update.

---

## Permission Matrix

| Role | Role ID | Can Upload | Can View | Notes |
|------|---------|-----------|---------|-------|
| **Admin** | `admin` | ✅ Yes | ✅ Yes | Full system access, can upload and view all documents |
| **IT Head** | `it_head` | ✅ Yes | ✅ Yes | Can manage all IT documents system-wide |
| **Regional IT Head** | `regional_it_head` | ✅ Yes | ✅ Yes | Can manage IT documents for their region |
| **IT Staff** | `it_staff` | ✅ Yes | ✅ Yes | Can upload from any location, no restrictions |
| **IT Store Head** | `it_store_head` | ✅ **NEW** | ✅ Yes | **NEW PERMISSION** - Can upload IT store-related documents |
| **Service Desk Head (HO)** | `service_desk_head` | ✅ **NEW** | ✅ Yes | **NEW PERMISSION** - Can upload service desk documents from HO |
| Service Desk Staff | `service_desk_staff` | ❌ No | ✅ Yes | Cannot upload, view-only access to documents |
| Store Keeper | `store_keeper` | ❌ No | ✅ Limited | Cannot upload, manages store items separately |

---

## Changes Summary

### Newly Granted Upload Permission (As Requested)

The following 2 roles have been **NEWLY GRANTED** the ability to upload documents:

1. ✅ **IT Store Head** (`it_store_head`)
   - Role description: Store manager responsible for IT equipment inventory
   - New capability: Can now upload IT store-related documents and reports

2. ✅ **Service Desk Head (HO)** (`service_desk_head`)
   - Role description: Head of Service Desk at Head Office
   - New capability: Can now upload service desk documents and reports

### Already Had Permission (Maintained)

The following 4 roles already had permission and continue to have it:

1. ✅ **Admin** (`admin`)
2. ✅ **IT Head** (`it_head`)
3. ✅ **Regional IT Head** (`regional_it_head`)
4. ✅ **IT Staff** (`it_staff`)

---

## Feature Location

**Page:** IT Documents & Reports (`/dashboard/it-documents`)

**Button:** "Upload Document" (green button in the top-right corner)

**Visibility:** Button is conditionally rendered based on user role

---

## Implementation Details

### Frontend Permission Check
**File:** `/components/reports/pdf-uploads-dashboard.tsx` (Line 152-153)

```typescript
const canUpload = user && (
  ["admin", "it_head", "regional_it_head", "it_staff", "it_store_head", "service_desk_head"].includes(user.role)
)
```

### Button Rendering
**File:** `/components/reports/pdf-uploads-dashboard.tsx` (Line 586)

```typescript
{canUpload && (
  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
    <DialogTrigger asChild>
      <Button className="gap-2">
        <Upload className="h-4 w-4" />
        Upload Document
      </Button>
    </DialogTrigger>
    {/* Dialog content for upload form */}
  </Dialog>
)}
```

---

## Visual Representation

### For Users WITH Upload Permission:
```
┌─────────────────────────────────────────┐
│  IT Documents & Reports                 │
├─────────────────────────────────────────┤
│                   [🟢 Upload Document]  │ ← GREEN button visible
│                                         │
│  Total Documents: 133                   │
│  Toner Reports: 50                      │
│  Quarterly Reports: 14                  │
│  • And more statistics...               │
└─────────────────────────────────────────┘
```

### For Users WITHOUT Upload Permission:
```
┌─────────────────────────────────────────┐
│  IT Documents & Reports                 │
├─────────────────────────────────────────┤
│                                         │ ← Button NOT visible
│  Total Documents: 133                   │
│  Toner Reports: 50                      │
│  Quarterly Reports: 14                  │
│  • And more statistics...               │
└─────────────────────────────────────────┘
```

---

## Test Coverage

### Permission Simulation Test Results

All 8 test cases passed successfully:

```
✅ PASS | Admin can upload                    → true ✓
✅ PASS | IT Head can upload                  → true ✓
✅ PASS | Regional IT Head can upload         → true ✓
✅ PASS | IT Staff can upload                 → true ✓
✅ PASS | IT Store Head can upload            → true ✓ [NEW]
✅ PASS | Service Desk Head can upload        → true ✓ [NEW]
✅ PASS | Service Desk Staff cannot upload    → false ✓
✅ PASS | Store Keeper cannot upload          → false ✓
```

---

## User Journey Examples

### Example 1: IT Store Head Uploading Document

1. User with role `it_store_head` logs in
2. Navigates to Dashboard → IT Documents
3. **Sees the green "Upload Document" button** ✅
4. Clicks the button
5. Dialog opens with upload form
6. User uploads IT inventory document
7. Document appears in the list with "Published" status

### Example 2: Service Desk Staff Trying to Upload

1. User with role `service_desk_staff` logs in
2. Navigates to Dashboard → IT Documents
3. **Does NOT see the "Upload Document" button** ✓
4. Can view existing documents for their location
5. Cannot perform upload action

---

## Database Roles Reference

Current database roles for reference:

```sql
ENUM user_role VALUES (
  'admin',
  'it_head',
  'regional_it_head',
  'it_staff',
  'it_store_head',              -- Updated to include upload permission
  'service_desk_head',          -- Updated to include upload permission
  'service_desk_staff',
  'store_keeper',
  'finance_officer',
  'logistics_officer'
)
```

---

## Deployment Checklist

- [x] Code changes implemented in `/components/reports/pdf-uploads-dashboard.tsx`
- [x] Permission logic updated
- [x] Backward compatibility maintained
- [x] Test cases created and passed (8/8)
- [x] Documentation updated
- [x] No database migration required
- [x] No API changes required
- [ ] Deployed to production
- [ ] Users notified of new permission
- [ ] Monitoring activated

---

## Rollback Plan

If needed, changes can be rolled back within seconds by reverting the single file:
- File: `/components/reports/pdf-uploads-dashboard.tsx`
- Lines: 152-153
- Impact: Minimal - only UI rendering affected

---

## Support & Troubleshooting

### If user doesn't see the Upload button:

1. **Verify user role:** Check that user is one of: `admin`, `it_head`, `regional_it_head`, `it_staff`, `it_store_head`, or `service_desk_head`
2. **Refresh page:** Hard refresh the browser (Ctrl+F5 or Cmd+Shift+R)
3. **Clear cache:** Clear browser cache and reload
4. **Check backend:** Verify user role in database matches their profile

### If Upload button shows but upload fails:

1. Check server-side validation in `/app/api/pdf-uploads/route.ts`
2. Verify user has valid session token
3. Check Supabase and Vercel Blob configuration
4. Review browser console for error messages

---

## Contact & Escalation

For issues related to upload permissions:
1. First check this permission matrix
2. Review troubleshooting section above
3. Check console logs for error messages
4. Escalate to IT administrator if needed
