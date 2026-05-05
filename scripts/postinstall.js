#!/usr/bin/env node
// postinstall for local dev:
//   1) patch-package applies any /patches
//   2) typegen regenerates client/src/appKitTypes.d.ts from config/queries/*.sql
//
// In production (e.g. Databricks Apps deploy containers) we skip both:
//   - patch-package lives in devDependencies, which production installs
//     exclude, so invoking it would fail.
//   - appKitTypes.d.ts is already committed, so the runtime doesn't need
//     typegen at install time.
import { spawnSync } from 'node:child_process';

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  console.log('[postinstall] NODE_ENV=production — skipping patch-package and typegen');
  process.exit(0);
}

function run(cmd, args) {
  console.log(`[postinstall] ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('npx', ['patch-package']);
run('npm', ['run', 'typegen']);
