# Deploying `team-pto-tracker`

This doc walks through deploying the PTO tracker to a Databricks workspace. You'll run these commands from your own machine (not from inside the editor).

- **App name:** `team-pto-tracker`
- **Warehouse:** `565afbdfa7ed5fe4` (overridable in `databricks.yml`)
- **Data:** Managed Delta table `workspace.default.pto_entries`

There are two supported flows. Pick one:

1. **DAB (Databricks Asset Bundles)** — recommended. One command handles sync + deploy + resource wiring.
2. **Manual** — sync source to a workspace path, then call `databricks apps deploy` directly.

---

## Prerequisites

- `databricks` CLI installed (`brew install databricks/tap/databricks` or see Databricks docs).
- Authenticated to the target workspace:
  ```bash
  databricks auth login --host https://<your-workspace>.databricks.com
  ```
- Local build tools: Node 20+, `npm`.
- A SQL warehouse you can attach the app to (the default in `databricks.yml` is `565afbdfa7ed5fe4` — change it if you want a different one).
- The Delta table exists:
  ```sql
  CREATE TABLE IF NOT EXISTS workspace.default.pto_entries (
    id STRING NOT NULL,
    person_name STRING NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    note STRING,
    created_at TIMESTAMP NOT NULL
  ) USING DELTA;
  ```
  (Already created in the dev workspace.)

---

## Flow A — DAB (recommended)

```bash
# 1. Validate the bundle
databricks bundle validate

# 2. Build the client + server
npm ci
npm run build

# 3. Deploy the bundle (creates the app record if missing, syncs files,
#    applies resource permissions declared in databricks.yml)
databricks bundle deploy

# 4. Start / restart the app
databricks bundle run app

# 5. Get the app URL and status
databricks apps get team-pto-tracker
```

If `bundle validate` rejects the `uc_securable` resource in `databricks.yml` (some CLI versions don't support it yet), delete the `pto_table` block from the `resources:` list and grant the table permissions manually — see [Permissions](#permissions) below.

---

## Flow B — Manual

```bash
# 1. Build
npm ci
npm run build

# 2. Create the app (first time only)
databricks apps create team-pto-tracker

# 3. Sync your working tree to a workspace path
USER_EMAIL=$(databricks current-user me --output json | jq -r .userName)
WS_PATH="/Workspace/Users/${USER_EMAIL}/team-pto-tracker"
databricks sync --full . "$WS_PATH"

# 4. Deploy from that workspace path
databricks apps deploy team-pto-tracker --source-code-path "$WS_PATH"

# 5. Check status
databricks apps get team-pto-tracker
```

Iterative updates: re-run `npm run build` → `databricks sync . "$WS_PATH"` → `databricks apps deploy …`.

---

## Permissions

Deployed apps run as a **service principal**, which is different from your user and different from the dev-environment SP. That SP needs Unity Catalog grants on the table and `CAN_USE` on the warehouse. DAB handles the warehouse grant via the declared resource; you'll need to handle the table grants either via the `uc_securable` resource block or manually.

### Find the app's service principal

After creating the app, grab its SP application ID:

```bash
databricks apps get team-pto-tracker --output json | jq -r '.service_principal_client_id'
```

Export it for the grant commands:

```bash
APP_SP=$(databricks apps get team-pto-tracker --output json | jq -r '.service_principal_client_id')
```

### Required grants (run once after the app is created)

```sql
-- Catalog + schema traversal
GRANT USE CATALOG ON CATALOG workspace TO `${APP_SP}`;
GRANT USE SCHEMA  ON SCHEMA  workspace.default TO `${APP_SP}`;

-- Read and write on the PTO table (the app does INSERT and DELETE)
GRANT SELECT, MODIFY ON TABLE workspace.default.pto_entries TO `${APP_SP}`;
```

You can run those with the CLI:

```bash
databricks experimental aitools tools query "GRANT USE CATALOG ON CATALOG workspace TO \`${APP_SP}\`"
databricks experimental aitools tools query "GRANT USE SCHEMA  ON SCHEMA  workspace.default TO \`${APP_SP}\`"
databricks experimental aitools tools query "GRANT SELECT, MODIFY ON TABLE workspace.default.pto_entries TO \`${APP_SP}\`"
```

### Warehouse access

Declared in `databricks.yml` as a `CAN_USE` resource — `databricks bundle deploy` applies it automatically. If you deployed via the manual flow, grant it in the UI (SQL Warehouses → your warehouse → Permissions → add the app SP with `Can Use`) or via the CLI:

```bash
databricks warehouses get-permissions 565afbdfa7ed5fe4
# then PATCH with CAN_USE for the app SP
```

---

## Smoke-test the deployment

Once the app is running, hit:

- `https://<app-url>/health` → should return `{"status":"ok"}`.
- Open the app URL in a browser, log a PTO entry, and verify it appears in `workspace.default.pto_entries`:
  ```bash
  databricks experimental aitools tools query "SELECT * FROM workspace.default.pto_entries ORDER BY created_at DESC LIMIT 5"
  ```

If the list/timeline/heatmap are empty in the deployed app but the table has rows, that's almost always a missing `SELECT` grant on the table for the app SP.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `PERMISSION_DENIED` when loading entries | App SP missing `SELECT` on table | Run the `GRANT SELECT` command above |
| `Table or view not found` | App SP missing `USE CATALOG`/`USE SCHEMA` | Run the two `GRANT USE ...` commands |
| `POST /api/pto` 500s | App SP missing `MODIFY` on table | Run `GRANT MODIFY ON TABLE ...` |
| App starts but 502s | `npm run build` wasn't run, or `dist/` missing | Rebuild locally, redeploy |
| Queries time out | Warehouse is stopped | Start the warehouse, or use Serverless |
| `bundle validate` rejects `uc_securable` | CLI version doesn't support it | Remove `pto_table` from `databricks.yml` resources; grant manually |

---

## Rollback / teardown

```bash
# Stop the app
databricks apps stop team-pto-tracker

# Delete the deployment (keeps the Delta table untouched)
databricks apps delete team-pto-tracker

# (Optional) drop the data
databricks experimental aitools tools query "DROP TABLE workspace.default.pto_entries"
```
