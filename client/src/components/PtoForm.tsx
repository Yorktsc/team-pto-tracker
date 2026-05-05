import { useState } from 'react';
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from '@databricks/appkit-ui/react';
import type { DateRange } from 'react-day-picker';
import { toISODate, formatHuman, dayCountInclusive } from '../lib/dates';

interface PtoFormProps {
  onCreated: () => void;
}

export function PtoForm({ onCreated }: PtoFormProps) {
  const [name, setName] = useState('');
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = range?.from ? toISODate(range.from) : '';
  const endDate = range?.to ? toISODate(range.to) : range?.from ? toISODate(range.from) : '';
  const ready = name.trim().length > 0 && startDate !== '' && endDate !== '';
  const dayCount = ready ? dayCountInclusive(startDate, endDate) : 0;

  const handleSubmit = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/pto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          person_name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          note: note.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      // Reset form
      setRange(undefined);
      setNote('');
      // Keep name to make successive entries easy
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Log PTO</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="person-name">Your name</Label>
            <Input
              id="person-name"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Select dates</Label>
            <div className="rounded-md border p-2 flex justify-center">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={range}
                onSelect={setRange}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {range?.from && range?.to ? (
                <span>
                  {formatHuman(toISODate(range.from))} &rarr; {formatHuman(toISODate(range.to))}{' '}
                  <span className="font-medium text-foreground">({dayCount} day{dayCount === 1 ? '' : 's'})</span>
                </span>
              ) : range?.from ? (
                <span>Start: {formatHuman(toISODate(range.from))} — pick end date</span>
              ) : (
                <span>Pick a start and end date</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Vacation, conference, personal, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <div className="text-destructive bg-destructive/10 p-3 rounded-md text-sm">{error}</div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!ready || submitting}>
              {submitting ? 'Saving…' : 'Log PTO'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
