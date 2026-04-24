-- Migration: Add explicit IT manager approval fields for non-requisition forms
-- Purpose: Prevent office-use confirmation fields from being reused as manager approval fields,
--          and backfill historical manager approvals from existing notes/timeline.

-- 1) Add dedicated manager approval columns
ALTER TABLE IF EXISTS public.new_gadget_requests
  ADD COLUMN IF NOT EXISTS it_manager_approved_by text,
  ADD COLUMN IF NOT EXISTS it_manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS it_manager_signature text;

ALTER TABLE IF EXISTS public.maintenance_repair_requests
  ADD COLUMN IF NOT EXISTS it_manager_approved_by text,
  ADD COLUMN IF NOT EXISTS it_manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS it_manager_signature text;

COMMENT ON COLUMN public.new_gadget_requests.it_manager_approved_by IS 'Manager approver display name for Section D approval';
COMMENT ON COLUMN public.new_gadget_requests.it_manager_approved_at IS 'Manager approval timestamp for Section D approval';
COMMENT ON COLUMN public.new_gadget_requests.it_manager_signature IS 'Base64 PNG digital signature for manager approval';

COMMENT ON COLUMN public.maintenance_repair_requests.it_manager_approved_by IS 'Manager approver display name for Section D approval';
COMMENT ON COLUMN public.maintenance_repair_requests.it_manager_approved_at IS 'Manager approval timestamp for Section D approval';
COMMENT ON COLUMN public.maintenance_repair_requests.it_manager_signature IS 'Base64 PNG digital signature for manager approval';

-- 2) Backfill from approval_timeline where available
--    Extract latest manager-equivalent event per request.
WITH manager_events AS (
  SELECT
    r.id,
    evt.elem->>'approver' AS approver,
    NULLIF(evt.elem->>'timestamp', '')::timestamptz AS approved_at,
    NULLIF(evt.elem->>'signatureDataUrl', '') AS signature_data_url,
    row_number() OVER (
      PARTITION BY r.id
      ORDER BY NULLIF(evt.elem->>'timestamp', '')::timestamptz DESC NULLS LAST
    ) AS rn
  FROM public.new_gadget_requests r
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      to_jsonb(r)->'approval_timeline',
      to_jsonb(r)->'approval_chain',
      '[]'::jsonb
    ) AS timeline_json
  ) t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.timeline_json) = 'array' THEN t.timeline_json
      ELSE '[]'::jsonb
    END
  ) AS evt(elem)
  WHERE lower(COALESCE(evt.elem->>'role', '')) IN ('it_manager', 'it_head', 'regional_it_head')
)
UPDATE public.new_gadget_requests r
SET
  it_manager_approved_by = COALESCE(r.it_manager_approved_by, me.approver),
  it_manager_approved_at = COALESCE(r.it_manager_approved_at, me.approved_at),
  it_manager_signature = COALESCE(r.it_manager_signature, me.signature_data_url),
  updated_at = now()
FROM manager_events me
WHERE r.id = me.id
  AND me.rn = 1
  AND (
    r.it_manager_approved_by IS NULL OR
    r.it_manager_approved_at IS NULL OR
    r.it_manager_signature IS NULL
  );

WITH manager_events AS (
  SELECT
    r.id,
    evt.elem->>'approver' AS approver,
    NULLIF(evt.elem->>'timestamp', '')::timestamptz AS approved_at,
    NULLIF(evt.elem->>'signatureDataUrl', '') AS signature_data_url,
    row_number() OVER (
      PARTITION BY r.id
      ORDER BY NULLIF(evt.elem->>'timestamp', '')::timestamptz DESC NULLS LAST
    ) AS rn
  FROM public.maintenance_repair_requests r
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      to_jsonb(r)->'approval_timeline',
      to_jsonb(r)->'approval_chain',
      '[]'::jsonb
    ) AS timeline_json
  ) t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.timeline_json) = 'array' THEN t.timeline_json
      ELSE '[]'::jsonb
    END
  ) AS evt(elem)
  WHERE lower(COALESCE(evt.elem->>'role', '')) IN ('it_manager', 'it_head', 'regional_it_head')
)
UPDATE public.maintenance_repair_requests r
SET
  it_manager_approved_by = COALESCE(r.it_manager_approved_by, me.approver),
  it_manager_approved_at = COALESCE(r.it_manager_approved_at, me.approved_at),
  it_manager_signature = COALESCE(r.it_manager_signature, me.signature_data_url),
  updated_at = now()
FROM manager_events me
WHERE r.id = me.id
  AND me.rn = 1
  AND (
    r.it_manager_approved_by IS NULL OR
    r.it_manager_approved_at IS NULL OR
    r.it_manager_signature IS NULL
  );

-- 3) Backfill from legacy note pattern if timeline row is missing
-- Pattern: "IT Manager approved note: ... (by NAME on TIMESTAMP)"
UPDATE public.new_gadget_requests
SET
  it_manager_approved_by = COALESCE(
    it_manager_approved_by,
    NULLIF((regexp_match(other_comments, '\\(by\\s+(.+?)\\s+on\\s+[^\\)]+\\)'))[1], '')
  ),
  it_manager_approved_at = COALESCE(
    it_manager_approved_at,
    NULLIF((regexp_match(other_comments, '\\(by\\s+.+?\\s+on\\s+([^\\)]+)\\)'))[1], '')::timestamptz
  ),
  updated_at = now()
WHERE
  (it_manager_approved_by IS NULL OR it_manager_approved_at IS NULL)
  AND other_comments ILIKE '%IT Manager approved note:%';

UPDATE public.maintenance_repair_requests
SET
  it_manager_approved_by = COALESCE(
    it_manager_approved_by,
    NULLIF((regexp_match(other_comments, '\\(by\\s+(.+?)\\s+on\\s+[^\\)]+\\)'))[1], '')
  ),
  it_manager_approved_at = COALESCE(
    it_manager_approved_at,
    NULLIF((regexp_match(other_comments, '\\(by\\s+.+?\\s+on\\s+([^\\)]+)\\)'))[1], '')::timestamptz
  ),
  updated_at = now()
WHERE
  (it_manager_approved_by IS NULL OR it_manager_approved_at IS NULL)
  AND other_comments ILIKE '%IT Manager approved note:%';

-- 4) Fallback backfill from legacy approval columns used before dedicated manager columns existed
UPDATE public.new_gadget_requests
SET
  it_manager_approved_by = COALESCE(it_manager_approved_by, it_head_approved_by, admin_approved_by, confirmed_by),
  it_manager_approved_at = COALESCE(it_manager_approved_at, it_head_approved_at, admin_approved_at, confirmed_date),
  it_manager_signature = COALESCE(it_manager_signature, it_head_signature, admin_signature),
  updated_at = now()
WHERE
  it_manager_approved_by IS NULL
  OR it_manager_approved_at IS NULL
  OR it_manager_signature IS NULL;

UPDATE public.maintenance_repair_requests
SET
  it_manager_approved_by = COALESCE(it_manager_approved_by, it_head_approved_by, admin_approved_by, confirmed_by),
  it_manager_approved_at = COALESCE(it_manager_approved_at, it_head_approved_at, admin_approved_at, confirmed_date),
  it_manager_signature = COALESCE(it_manager_signature, it_head_signature, admin_signature),
  updated_at = now()
WHERE
  it_manager_approved_by IS NULL
  OR it_manager_approved_at IS NULL
  OR it_manager_signature IS NULL;

-- 5) Final fallback: pull reusable signature profile by approver full name/username when request-level signature is still null
UPDATE public.new_gadget_requests r
SET
  it_manager_signature = sig.signature_data_url,
  updated_at = now()
FROM LATERAL (
  SELECT sp.signature_data_url
  FROM public.profiles p
  JOIN public.it_form_signature_profiles sp ON sp.user_id = p.id
  WHERE
    r.it_manager_approved_by IS NOT NULL
    AND (
      lower(trim(COALESCE(p.full_name, ''))) = lower(trim(r.it_manager_approved_by))
      OR lower(trim(COALESCE(p.username, ''))) = lower(trim(r.it_manager_approved_by))
    )
    AND sp.role IN ('it_head', 'regional_it_head', 'admin', 'department_head')
  ORDER BY sp.updated_at DESC NULLS LAST
  LIMIT 1
) sig
WHERE
  r.it_manager_signature IS NULL
  AND sig.signature_data_url IS NOT NULL;

UPDATE public.maintenance_repair_requests r
SET
  it_manager_signature = sig.signature_data_url,
  updated_at = now()
FROM LATERAL (
  SELECT sp.signature_data_url
  FROM public.profiles p
  JOIN public.it_form_signature_profiles sp ON sp.user_id = p.id
  WHERE
    r.it_manager_approved_by IS NOT NULL
    AND (
      lower(trim(COALESCE(p.full_name, ''))) = lower(trim(r.it_manager_approved_by))
      OR lower(trim(COALESCE(p.username, ''))) = lower(trim(r.it_manager_approved_by))
    )
    AND sp.role IN ('it_head', 'regional_it_head', 'admin', 'department_head')
  ORDER BY sp.updated_at DESC NULLS LAST
  LIMIT 1
) sig
WHERE
  r.it_manager_signature IS NULL
  AND sig.signature_data_url IS NOT NULL;
