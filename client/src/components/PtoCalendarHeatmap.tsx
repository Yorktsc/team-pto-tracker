import { useMemo, useState } from 'react';
import {
  useAnalyticsQuery,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Button,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  toISODate,
  fromISODate,
  formatHuman,
  addDaysISO,
  todayISO,
} from '../lib/dates';

function firstOfMonth(year: number, month: number): string {
  return toISODate(new Date(year, month, 1));
}

function lastOfMonth(year: number, month: number): string {
  // last day: day 0 of next month
  return toISODate(new Date(year, month + 1, 0));
}

// Shade class based on how many people are out
function shadeFor(count: number, maxCount: number): string {
  if (count <= 0) return 'bg-card';
  // Normalize to 4 buckets
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (count === 1) return 'bg-primary/20';
  if (ratio < 0.34) return 'bg-primary/30';
  if (ratio < 0.67) return 'bg-primary/55';
  return 'bg-primary/85';
}

function textColorFor(count: number, maxCount: number): string {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (count === 0) return 'text-muted-foreground';
  if (ratio >= 0.67) return 'text-primary-foreground';
  return 'text-foreground';
}

interface PtoCalendarHeatmapProps {
  cacheKey: string;
}

export function PtoCalendarHeatmap({ cacheKey }: PtoCalendarHeatmapProps) {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth()); // 0-indexed

  const startISO = firstOfMonth(year, month);
  const endISO = lastOfMonth(year, month);

  const params = useMemo(
    () => ({
      start_date: sql.date(startISO),
      end_date: sql.date(endISO),
      cache_key: sql.string(cacheKey),
    }),
    [startISO, endISO, cacheKey]
  );

  const { data, loading, error } = useAnalyticsQuery('pto_daily_coverage', params);

  const coverageByDay = useMemo(() => {
    const map = new Map<string, { count: number; people: string }>();
    if (data) {
      for (const row of data) {
        map.set(row.day, { count: Number(row.people_out_count), people: row.people_out });
      }
    }
    return map;
  }, [data]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const v of coverageByDay.values()) if (v.count > max) max = v.count;
    return max;
  }, [coverageByDay]);

  // Build calendar grid — Sunday-start
  const firstDate = fromISODate(startISO);
  const lastDate = fromISODate(endISO);
  const startPadding = firstDate.getDay(); // 0 = Sun
  const gridStartISO = addDaysISO(startISO, -startPadding);
  // Determine how many cells we need (round up to full weeks)
  const daysInMonth = lastDate.getDate();
  const totalCells = Math.ceil((startPadding + daysInMonth) / 7) * 7;

  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const iso = addDaysISO(gridStartISO, i);
    const d = fromISODate(iso);
    cells.push({ iso, inMonth: d.getMonth() === month });
  }

  const todayIso = todayISO();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Team Availability Heatmap</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium w-32 text-center">{monthLabel}</div>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data && (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}
        {error && (
          <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {error}</div>
        )}
        {!error && (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekdayLabels.map((w) => (
                <div key={w} className="text-xs text-muted-foreground text-center font-medium py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const coverage = coverageByDay.get(cell.iso);
                const count = coverage?.count ?? 0;
                const shade = shadeFor(count, maxCount);
                const textColor = textColorFor(count, maxCount);
                const isToday = cell.iso === todayIso;
                const day = fromISODate(cell.iso).getDate();
                const title = coverage
                  ? `${formatHuman(cell.iso)}\n${count} out: ${coverage.people}`
                  : `${formatHuman(cell.iso)}\nNobody out`;
                return (
                  <div
                    key={cell.iso}
                    className={`border rounded-md p-1.5 h-16 flex flex-col justify-between ${shade} ${
                      cell.inMonth ? '' : 'opacity-40'
                    } ${isToday ? 'ring-2 ring-red-500' : ''}`}
                    title={title}
                  >
                    <div className={`text-xs font-semibold ${textColor}`}>{day}</div>
                    {count > 0 && (
                      <div className={`text-[10px] ${textColor} truncate`} title={coverage?.people}>
                        <span className="font-bold">{count}</span> out
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
              <span>Fewer out</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-card border" />
                <div className="w-4 h-4 rounded bg-primary/20" />
                <div className="w-4 h-4 rounded bg-primary/30" />
                <div className="w-4 h-4 rounded bg-primary/55" />
                <div className="w-4 h-4 rounded bg-primary/85" />
              </div>
              <span>More out</span>
              {maxCount > 0 && (
                <span className="ml-auto">
                  Peak this month: <span className="font-semibold text-foreground">{maxCount}</span>{' '}
                  people out
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
