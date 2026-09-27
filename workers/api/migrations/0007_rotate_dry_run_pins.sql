-- Rotate the dry-run account PINs to a documented value (424242, distinct
-- salts) so the apps can be signed into during the dry run. These are
-- dry-run credentials: rotate to private PINs before the real event.
-- Pure UPDATE: idempotent, and other columns are never touched.

UPDATE users SET
  pin_hash = CASE id
    WHEN 'u_head' THEN 'g/UUWSbvmKnyHkRzQXA5c6IjQztG5HqgfBxNX+nRTRE='
    WHEN 'u_org' THEN 'L7wWGlHnhzIcMdK65tD8yQpcCHCR69z9TvrgSmxo+cE='
    WHEN 'u_it' THEN 'zp/IH/9IIzndi1zZxiINeLel9AGtiwwEajbZoWw6Y+g='
  END,
  pin_salt = CASE id
    WHEN 'u_head' THEN '28d0bc9f1c13b818f351f1762711e6b9'
    WHEN 'u_org' THEN '9838f0bfe4e9470dbfe40f3373af6b57'
    WHEN 'u_it' THEN '4114711c72020918450233c5c5e3304c'
  END
WHERE id IN ('u_head', 'u_org', 'u_it');
