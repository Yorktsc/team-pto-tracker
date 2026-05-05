import express from 'express';
import { createApp, server, analytics, getExecutionContext, CacheManager } from '@databricks/appkit';
import { randomUUID } from 'node:crypto';

const TABLE = 'workspace.default.pto_entries';

// ISO date regex: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function runStatement(
  statement: string,
  parameters: Array<{ name: string; value?: string; type?: string }> = []
) {
  const ctx = getExecutionContext();
  const warehouseId = await ctx.warehouseId;
  const resp = await ctx.client.statementExecution.executeStatement({
    statement,
    warehouse_id: warehouseId,
    wait_timeout: '30s',
    on_wait_timeout: 'CANCEL',
    parameters,
  });
  if (resp.status?.state !== 'SUCCEEDED') {
    const msg = resp.status?.error?.message ?? `Statement failed: ${resp.status?.state}`;
    throw new Error(msg);
  }
  return resp;
}

async function invalidateAnalyticsCache() {
  try {
    const cache = CacheManager.getInstanceSync();
    await cache.clear();
  } catch (err) {
    console.warn('Failed to clear analytics cache:', err);
  }
}

const appkit = await createApp({
  plugins: [
    server({ autoStart: false }),
    // Short cache TTL so mutations (create/delete PTO) are reflected quickly
    // in the analytics queries used by the UI.
    analytics({ cache: { enabled: true, ttl: 2 } }),
  ],
});

appkit.server.extend((app) => {
  app.use(express.json());

  // Create a PTO entry
  app.post('/api/pto', async (req, res) => {
    try {
      const body = req.body as {
        person_name?: unknown;
        start_date?: unknown;
        end_date?: unknown;
        note?: unknown;
      };
      const person_name = typeof body.person_name === 'string' ? body.person_name.trim() : '';
      const start_date = typeof body.start_date === 'string' ? body.start_date : '';
      const end_date = typeof body.end_date === 'string' ? body.end_date : '';
      const note = typeof body.note === 'string' ? body.note.trim() : '';

      if (!person_name) return res.status(400).json({ error: 'person_name is required' });
      if (!DATE_REGEX.test(start_date))
        return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' });
      if (!DATE_REGEX.test(end_date))
        return res.status(400).json({ error: 'end_date must be YYYY-MM-DD' });
      if (end_date < start_date)
        return res.status(400).json({ error: 'end_date must be on or after start_date' });

      const id = randomUUID();
      await runStatement(
        `INSERT INTO ${TABLE} (id, person_name, start_date, end_date, note, created_at)
         VALUES (:id, :person_name, :start_date, :end_date, :note, CURRENT_TIMESTAMP())`,
        [
          { name: 'id', value: id, type: 'STRING' },
          { name: 'person_name', value: person_name, type: 'STRING' },
          { name: 'start_date', value: start_date, type: 'DATE' },
          { name: 'end_date', value: end_date, type: 'DATE' },
          { name: 'note', value: note || undefined, type: 'STRING' },
        ]
      );
      await invalidateAnalyticsCache();
      return res.status(201).json({ id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('POST /api/pto failed:', message);
      return res.status(500).json({ error: message });
    }
  });

  // Delete a PTO entry
  app.delete('/api/pto/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'id is required' });
      await runStatement(`DELETE FROM ${TABLE} WHERE id = :id`, [
        { name: 'id', value: id, type: 'STRING' },
      ]);
      await invalidateAnalyticsCache();
      return res.status(200).json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('DELETE /api/pto failed:', message);
      return res.status(500).json({ error: message });
    }
  });
});

await appkit.server.start();
