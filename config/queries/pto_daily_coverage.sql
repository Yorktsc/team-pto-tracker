-- For each day with at least one person out, return the count of people out
-- and the comma-separated list of names. Expands each PTO entry into its
-- individual days using sequence() + explode().
-- :cache_key is used only to bust the analytics cache after mutations.
-- @param start_date DATE
-- @param end_date DATE
-- @param cache_key STRING
WITH expanded AS (
  SELECT
    person_name,
    explode(sequence(start_date, end_date, INTERVAL 1 DAY)) AS day
  FROM workspace.default.pto_entries
)
SELECT
  CAST(day AS STRING) AS day,
  COUNT(DISTINCT person_name) AS people_out_count,
  CONCAT_WS(', ', COLLECT_LIST(DISTINCT person_name)) AS people_out
FROM expanded
WHERE day >= :start_date
  AND day <= :end_date
  AND (:cache_key IS NOT NULL OR :cache_key IS NULL)
GROUP BY day
ORDER BY day ASC
