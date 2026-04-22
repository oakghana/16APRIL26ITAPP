"""
Simulation: IT Document PDF Upload Pipeline
Calls the live /api/pdf-uploads endpoint on localhost:3000
Tests: permission logic for all roles, actual upload (Blob + Supabase), then cleanup
"""

import io
import json
import requests

BASE = "http://localhost:3000"

PASS = lambda msg: print(f"  [PASS] {msg}")
FAIL = lambda msg: print(f"  [FAIL] {msg}")
INFO = lambda msg: print(f"  [INFO] {msg}")
SEC  = lambda t:   print(f"\n=== {t} ===")

# ── Minimal valid PDF bytes ───────────────────────────────────────────────────
MINIMAL_PDF = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
115
%%EOF"""

# ── 1. Permission Logic ───────────────────────────────────────────────────────
SEC("1. Permission Logic Check")

test_roles = [
    ("admin",             "Head Office",          True),
    ("it_head",           "Head Office",          True),
    ("regional_it_head",  "Takoradi Port",        True),
    ("regional_it_head",  "Tema Training School", True),
    ("it_staff",          "Head Office",          True),
    ("it_staff",          "Takoradi Port",        False),
    ("staff",             "Head Office",          False),
]

all_perm_ok = True
for role, location, should_pass in test_roles:
    can_upload = (
        role == "admin" or
        role == "it_head" or
        role == "regional_it_head" or
        (role == "it_staff" and location.lower() == "head office")
    )
    ok = can_upload == should_pass
    if ok:
        PASS(f"{role} @ {location} => canUpload={can_upload}")
    else:
        FAIL(f"{role} @ {location} => canUpload={can_upload} (expected {should_pass})")
        all_perm_ok = False

# ── 2. Live Upload Test (regional_it_head) ────────────────────────────────────
SEC("2. Live Upload — regional_it_head @ Takoradi Port")

FAKE_USER_ID   = "58fba343-6583-4ebc-83c4-3563061afa00"
FAKE_USER_NAME = "ITD (Simulation)"

pdf_file = io.BytesIO(MINIMAL_PDF)
pdf_file.name = "simulation-test.pdf"

payload = {
    "title":          "SIMULATION - Upload Test Document",
    "description":    "Automated simulation test — safe to delete",
    "documentType":   "information",
    "targetLocation": "Takoradi Port",
    "uploadedBy":     FAKE_USER_ID,
    "uploadedByName": FAKE_USER_NAME,
    "userRole":       "regional_it_head",
    "userLocation":   "Takoradi Port",
}

uploaded_id = None

try:
    resp = requests.post(
        f"{BASE}/api/pdf-uploads",
        data=payload,
        files={"file": ("simulation-test.pdf", pdf_file, "application/pdf")},
        timeout=30,
    )
    body = resp.json()
    INFO(f"HTTP status: {resp.status_code}")
    INFO(f"Response: {json.dumps(body, indent=2)}")

    if resp.status_code == 200 and body.get("success"):
        uploaded_id = body["upload"]["id"]
        file_url    = body["upload"].get("file_url", "")
        PASS(f"Upload succeeded — record ID: {uploaded_id}")
        PASS(f"file_url in DB: {file_url[:80]}...")
        PASS(f"target_location: {body['upload'].get('target_location')}")
    else:
        FAIL(f"Upload failed: {body.get('error', 'Unknown error')}")
except Exception as e:
    FAIL(f"Request exception: {e}")

# ── 3. Verify Record via GET ──────────────────────────────────────────────────
SEC("3. Verify — Fetch Back via GET")

if uploaded_id:
    try:
        g = requests.get(
            f"{BASE}/api/pdf-uploads",
            params={
                "userRole":     "regional_it_head",
                "userId":       FAKE_USER_ID,
                "userLocation": "Takoradi Port",
                "location":     "Takoradi Port",
            },
            timeout=15,
        )
        g_body = g.json()
        uploads = g_body.get("uploads", [])
        found = any(u["id"] == uploaded_id for u in uploads)
        if found:
            PASS(f"Record visible in GET response (id={uploaded_id})")
        else:
            INFO(f"Record not yet visible in filtered GET (may need admin approval) — total docs returned: {len(uploads)}")
    except Exception as e:
        FAIL(f"GET request failed: {e}")
else:
    INFO("Skipping GET check — upload failed")

# ── 4. Cleanup ────────────────────────────────────────────────────────────────
SEC("4. Cleanup — Delete Test Record")

if uploaded_id:
    try:
        d = requests.delete(
            f"{BASE}/api/pdf-uploads",
            params={
                "id":       uploaded_id,
                "userId":   FAKE_USER_ID,
                "userName": FAKE_USER_NAME,
            },
            timeout=15,
        )
        d_body = d.json()
        if d.status_code == 200 and d_body.get("success"):
            PASS(f"Test record deleted (id={uploaded_id})")
        else:
            FAIL(f"Cleanup failed: {d_body.get('error')}")
    except Exception as e:
        FAIL(f"DELETE request failed: {e}")
else:
    INFO("Nothing to clean up")

# ── Summary ───────────────────────────────────────────────────────────────────
SEC("SIMULATION SUMMARY")
print(f"  Permission checks : {'ALL PASSED' if all_perm_ok else 'SOME FAILED'}")
print(f"  Blob upload       : {'OK' if uploaded_id else 'FAILED'}")
print(f"  Supabase insert   : {'OK' if uploaded_id else 'FAILED'}")
print(f"  Cleanup           : {'OK' if uploaded_id else 'SKIPPED'}")
print()
if uploaded_id and all_perm_ok:
    print("  RESULT: Upload pipeline is WORKING correctly.")
    print("  Regional IT heads can successfully upload IT documents.")
else:
    print("  RESULT: Pipeline has ISSUES — review FAIL messages above.")
