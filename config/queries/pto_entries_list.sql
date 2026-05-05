-- List all PTO entries, ordered by start date.
-- :cache_key is a client-supplied value used only to bust the analytics
-- cache after mutations; it is intentionally ignored by the query itself.
-- @param cache_key STRING
SELECT
  id,
  person_name,
  CAST(start_date AS STRING) AS start_date,
  CAST(end_date AS STRING) AS end_date,
  COALESCE(note, '') AS note,
  CAST(created_at AS STRING) AS created_at
FROM workspace.default.pto_entries
WHERE (:cache_key IS NOT NULL OR :cache_key IS NULL)
ORDER BY start_date ASC, person_name ASC
