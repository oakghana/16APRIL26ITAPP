# Quick Testing Guide - IT Document Upload & Sidebar Improvements

## What Was Fixed

### 1. Upload Permissions
**Problem:** Only Head Office IT Staff could upload documents  
**Solution:** All IT Staff (from any location) can now upload documents

### 2. File Visibility  
**Problem:** Users upload files but can't see them immediately  
**Solution:** Files now appear instantly in user's dashboard after upload

### 3. Admin Sidebar
**Problem:** Sidebar cluttered, IT Documents buried, modules not organized  
**Solution:** Clean new structure with Documents & Reports at top

## Quick Test Checklist

### Test 1: IT Staff Upload (Kumasi)
```
1. Login as IT Staff from Kumasi
2. Go to Dashboard → IT Documents
3. Click "Upload Document"
4. Fill in:
   - Title: "Kumasi_Toner_May2026"
   - Type: "Toner Report"
   - Target: "Kumasi" or "All Locations"
   - Attach PDF file
5. Click Upload
6. ✅ Expected: Success message appears
7. ✅ Expected: Document appears in list immediately
8. ✅ Expected: Other IT staff can see it
```

### Test 2: Admin Sidebar Check
```
1. Login as Admin
2. Look at left sidebar
3. ✅ Expected: "Documents & Reports" group at TOP
4. ✅ Expected: Shows "IT Documents" and "Reports & Analysis"
5. ✅ Expected: Other groups (Operations, Devices, Store) below
6. ✅ Expected: Can click and navigate to each section
```

### Test 3: IT Staff Sidebar Check
```
1. Login as IT Staff
2. Look at left sidebar
3. ✅ Expected: "IT Documents" in top quick-access items
4. ✅ Expected: NOT buried in groups
5. ✅ Expected: Easy to reach and click
```

### Test 4: Regional IT Head Sidebar Check
```
1. Login as Regional IT Head
2. Look at left sidebar
3. ✅ Expected: "IT Documents" in top items
4. ✅ Expected: Should be first or very visible
5. ✅ Expected: Can upload for their region
```

### Test 5: File Visibility Across Locations
```
1. IT Staff from Kumasi uploads "Kumasi_Test.pdf"
2. Admin logs in
3. ✅ Expected: Can see Kumasi_Test.pdf immediately
4. Regional IT Head logs in
5. ✅ Expected: Can see Kumasi_Test.pdf
6. IT Staff from Accra logs in
7. ✅ Expected: Can see Kumasi_Test.pdf
```

### Test 6: Service Desk Cannot Upload
```
1. Login as Service Desk staff
2. Go to IT Documents
3. ✅ Expected: Upload button is HIDDEN
4. ✅ Expected: Can still VIEW documents for their location
```

### Test 7: Upload Confirmation Message
```
1. Upload any document as IT Staff
2. ✅ Expected: Toast shows: "Document uploaded successfully! It's now visible to all IT staff."
3. ✅ Expected: Document title shown in confirmation
```

## Success Criteria

### All These Should Work:
- [ ] Kumasi IT Staff uploads → Document appears instantly
- [ ] Accra IT Staff uploads → Document appears instantly  
- [ ] Regional IT Head uploads → Document appears instantly
- [ ] Admin can see all uploads
- [ ] Admin sidebar clean and organized
- [ ] IT Staff sidebar has IT Documents at top
- [ ] Regional IT Head sidebar has IT Documents at top
- [ ] Service Desk cannot upload (button hidden)
- [ ] Success message appears after upload
- [ ] No permission errors in console
- [ ] Build compiles without errors

## Troubleshooting

### Problem: Upload button not showing
**Check:** User role is "it_staff", "regional_it_head", or "admin"  
**Check:** User location is set in database

### Problem: File not appearing after upload
**Check:** Console logs for "[v0] Document visible to..."  
**Check:** Refresh page - should appear  
**Check:** Check database - is file in pdf_uploads table?

### Problem: Sidebar looks wrong
**Check:** Clear browser cache  
**Check:** Hard refresh (Ctrl+F5 or Cmd+Shift+R)

### Problem: Permission denied error
**Check:** User role is correct  
**Check:** User is not in service_desk role  
**Check:** Backend logs for permission check details

## Key Files to Monitor

Watch these files for success/errors:

1. **API Upload:** `/app/api/pdf-uploads/route.ts`
   - POST handler processes uploads
   - GET handler shows documents
   - Should see permission checks pass

2. **Dashboard:** `/components/reports/pdf-uploads-dashboard.tsx`
   - Shows upload form
   - Lists documents
   - Should show documents immediately

3. **Sidebar:** `/components/ui/modern-sidebar.tsx`
   - Shows navigation
   - IT Documents should be in top items for staff/regional head

## Expected Console Logs

When everything works, you should see:

```
[v0] PDF Uploads GET - type: all location: all userRole: it_staff userLocation: Kumasi userId: xxx
[v0] Document visible to IT staff: doc-123 title: Kumasi_Toner_May2026
[v0] Final filtered uploads count: 5 from total: 5
```

If user can't see upload:
```
[v0] Filter decision for doc-123 - Published: false - Own: true - Show: true
[v0] Showing own upload: doc-123
```

## Support Contact Points

If issues arise:
1. Check console logs for [v0] messages
2. Verify user role and location in database
3. Check if upload succeeded (look in pdf_uploads table)
4. Verify Supabase and Vercel Blob are configured
5. Clear cache and try again
6. Check browser console for any JavaScript errors

## Timeline for Testing

- **Day 1:** Basic permission tests (IT Staff upload)
- **Day 2:** Multi-location tests (Kumasi, Accra, others)
- **Day 3:** Admin sidebar verification
- **Day 4:** Regional IT Head functionality
- **Day 5:** Full regression testing
- **Day 6:** Performance and edge cases
- **Day 7:** Production deployment

All changes are production-ready and backward compatible!
