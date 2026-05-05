import { useMemo, useState } from 'react';
import {
  useAnalyticsQuery,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { formatHuman, dayCountInclusive } from '../lib/dates';

interface PtoEntriesListProps {
  onDeleted: () => void;
  cacheKey: string;
}

export function PtoEntriesList({ onDeleted, cacheKey }: PtoEntriesListProps) {
  const params = useMemo(() => ({ cache_key: sql.string(cacheKey) }), [cacheKey]);
  const { data, loading, error } = useAnalyticsQuery('pto_entries_list', params);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/pto/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>All PTO Entries</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {error && (
          <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {error}</div>
        )}
        {deleteError && (
          <div className="text-destructive bg-destructive/10 p-3 rounded-md mb-2">
            Delete failed: {deleteError}
          </div>
        )}
        {data && data.length === 0 && (
          <div className="text-muted-foreground text-sm py-6 text-center">
            No PTO logged yet. Use the form on the left to log your first entry.
          </div>
        )}
        {data && data.length > 0 && (
          <div className="divide-y">
            {data.map((row) => {
              const days = dayCountInclusive(row.start_date, row.end_date);
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{row.person_name}</span>
                      <Badge variant="secondary">
                        {days} day{days === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatHuman(row.start_date)} &rarr; {formatHuman(row.end_date)}
                    </div>
                    {row.note && (
                      <div className="text-sm text-muted-foreground italic mt-0.5 truncate">
                        {row.note}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(row.id)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
