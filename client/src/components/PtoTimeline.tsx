import { useMemo } from 'react';
import {
  useAnalyticsQuery,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { fromISODate, formatHuman, addDaysISO, dayCountInclusive, todayISO } from '../lib/dates';

// Color palette for distinct people
const PERSON_COLORS = [
  'hsl(210 90% 55%)',
  'hsl(160 75% 42%)',
  'hsl(340 80% 58%)',
  'hsl(40 90% 55%)',
  'hsl(280 70% 60%)',
  'hsl(10 80% 58%)',
  'hsl(195 75% 45%)',
  'hsl(90 55% 45%)',
];

function colorForPerson(name: string, index: number): string {
  // Stable deterministic color based on name hash; fallback to index palette
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length] ?? PERSON_COLORS[index % PERSON_COLORS.length]!;
}

interface PtoTimelineProps {
  cacheKey: string;
}

export function PtoTimeline({ cacheKey }: PtoTimelineProps) {
  const params = useMemo(() => ({ cache_key: sql.string(cacheKey) }), [cacheKey]);
  const { data, loading, error } = useAnalyticsQuery('pto_entries_list', params);

  const { rangeStart, rangeEnd, totalDays, peopleRows, dayMarkers } = useMemo(() => {
    if (!data || data.length === 0) {
      return { rangeStart: '', rangeEnd: '', totalDays: 0, peopleRows: [], dayMarkers: [] as { iso: string; isMonthStart: boolean; label: string }[] };
    }

    // Compute overall range: min start to max end, padded by a few days
    let minStart = data[0]!.start_date;
    let maxEnd = data[0]!.end_date;
    for (const row of data) {
      if (row.start_date < minStart) minStart = row.start_date;
      if (row.end_date > maxEnd) maxEnd = row.end_date;
    }
    // Pad by 2 days on each side
    const padded_start = addDaysISO(minStart, -2);
    const padded_end = addDaysISO(maxEnd, 2);
    const total_days = dayCountInclusive(padded_start, padded_end);

    // Group entries by person
    type Entry = { id: string; start_date: string; end_date: string; note: string };
    const byPerson = new Map<string, Entry[]>();
    for (const row of data) {
      const list = byPerson.get(row.person_name) ?? [];
      list.push({ id: row.id, start_date: row.start_date, end_date: row.end_date, note: row.note });
      byPerson.set(row.person_name, list);
    }
    const people_rows = Array.from(byPerson.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, entries], idx) => ({ name, entries, color: colorForPerson(name, idx) }));

    // Build month-start day markers across the range
    const day_markers: { iso: string; isMonthStart: boolean; label: string }[] = [];
    for (let i = 0; i < total_days; i++) {
      const iso = addDaysISO(padded_start, i);
      const d = fromISODate(iso);
      const isMonthStart = d.getDate() === 1;
      if (isMonthStart || i === 0) {
        day_markers.push({
          iso,
          isMonthStart,
          label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        });
      }
    }

    return {
      rangeStart: padded_start,
      rangeEnd: padded_end,
      totalDays: total_days,
      peopleRows: people_rows,
      dayMarkers: day_markers,
    };
  }, [data]);

  const todayIso = todayISO();
  const todayOffset =
    rangeStart && todayIso >= rangeStart && todayIso <= rangeEnd
      ? dayCountInclusive(rangeStart, todayIso) - 1
      : -1;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Team PTO Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {error && (
          <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {error}</div>
        )}
        {data && data.length === 0 && (
          <div className="text-muted-foreground text-sm py-6 text-center">
            No PTO entries yet — nothing to show on the timeline.
          </div>
        )}
        {data && data.length > 0 && totalDays > 0 && (
          <div className="overflow-x-auto">
            <div
              className="relative min-w-fit"
              style={{ minWidth: `${Math.max(600, totalDays * 18)}px` }}
            >
              {/* Header row: month labels */}
              <div className="flex text-xs text-muted-foreground border-b pb-1 mb-1 relative h-5">
                {dayMarkers.map((m) => {
                  const offset = dayCountInclusive(rangeStart, m.iso) - 1;
                  return (
                    <span
                      key={m.iso}
                      className="absolute font-medium"
                      style={{ left: `${(offset / totalDays) * 100}%` }}
                    >
                      {m.label}
                    </span>
                  );
                })}
              </div>

              {/* Today marker */}
              {todayOffset >= 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500/70 z-10 pointer-events-none"
                  style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                  title={`Today: ${formatHuman(todayIso)}`}
                >
                  <span className="absolute -top-0 left-1 text-[10px] text-red-600 font-semibold">
                    Today
                  </span>
                </div>
              )}

              {/* Person rows */}
              <div className="space-y-1.5">
                {peopleRows.map((person) => (
                  <div key={person.name} className="flex items-center gap-2">
                    <div
                      className="w-28 shrink-0 text-sm font-medium truncate pr-2"
                      title={person.name}
                    >
                      {person.name}
                    </div>
                    <div className="relative flex-1 h-7 bg-muted/40 rounded">
                      {person.entries.map((entry) => {
                        const startOffset = dayCountInclusive(rangeStart, entry.start_date) - 1;
                        const span = dayCountInclusive(entry.start_date, entry.end_date);
                        const left = (startOffset / totalDays) * 100;
                        const width = (span / totalDays) * 100;
                        return (
                          <div
                            key={entry.id}
                            className="absolute top-0.5 bottom-0.5 rounded px-1.5 text-[11px] font-medium text-white flex items-center overflow-hidden whitespace-nowrap shadow-sm"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              backgroundColor: person.color,
                            }}
                            title={`${person.name}: ${formatHuman(entry.start_date)} → ${formatHuman(entry.end_date)}${entry.note ? ` — ${entry.note}` : ''}`}
                          >
                            {span >= 2
                              ? `${formatHuman(entry.start_date)} → ${formatHuman(entry.end_date)}`
                              : formatHuman(entry.start_date)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
