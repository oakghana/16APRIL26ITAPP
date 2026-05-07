-- Migration: Merge takoradi_port → Takoradi Port
-- Renames the raw DB key "takoradi_port" to canonical display name "Takoradi Port"
-- across all tables that store a location column.
-- Run this once in the Supabase SQL editor.

-- 1. devices
UPDATE devices
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 2. profiles / users
UPDATE profiles
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 3. store_items
UPDATE store_items
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 4. central_store_items
UPDATE central_store_items
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 5. it_equipment_requisitions (requester_location)
UPDATE it_equipment_requisitions
SET requester_location = 'Takoradi Port'
WHERE LOWER(TRIM(requester_location)) = 'takoradi_port';

-- 6. it_equipment_requisitions (location)
UPDATE it_equipment_requisitions
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 7. store_requisitions
UPDATE store_requisitions
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 8. new_gadget_requests
UPDATE new_gadget_requests
SET location = 'Takoradi Port'
WHERE LOWER(TRIM(location)) = 'takoradi_port';

-- 9. locations lookup table (update the display name, keep code for legacy joins)
UPDATE locations
SET name = 'Takoradi Port'
WHERE LOWER(TRIM(code)) = 'takoradi_port'
  AND name != 'Takoradi Port';

-- Verification: should return 0 rows after migration
SELECT 'devices' AS table_name, COUNT(*) AS remaining_raw
FROM devices WHERE LOWER(TRIM(location)) = 'takoradi_port'
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles WHERE LOWER(TRIM(location)) = 'takoradi_port'
UNION ALL
SELECT 'store_items', COUNT(*) FROM store_items WHERE LOWER(TRIM(location)) = 'takoradi_port'
UNION ALL
SELECT 'it_equipment_requisitions (requester_location)', COUNT(*) FROM it_equipment_requisitions WHERE LOWER(TRIM(requester_location)) = 'takoradi_port'
UNION ALL
SELECT 'store_requisitions', COUNT(*) FROM store_requisitions WHERE LOWER(TRIM(location)) = 'takoradi_port';
