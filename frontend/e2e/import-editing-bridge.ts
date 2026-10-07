import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

export async function importEditingBridge(pages = 1) {
  const process = spawn(globalThis.process.env.CATANA_TEST_PYTHON || 'python3', [resolve('../backend/tests_support/import_editing_bridge.py'), String(pages)], {stdio: ['pipe', 'pipe', 'pipe']});
  const pending: Array<{resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void}> = [];
  const buffered: Record<string, unknown>[] = [];
  let diagnostic = '';
  let ended = false;
  process.stderr.on('data', value => {diagnostic = (diagnostic + String(value)).slice(-4000);});
  createInterface({input: process.stdout}).on('line', line => {
    const value = JSON.parse(line) as Record<string, unknown>;
    const waiter = pending.shift();
    if (waiter) waiter.resolve(value); else buffered.push(value);
  });
  process.on('exit', code => {ended = true; for (const waiter of pending.splice(0)) waiter.reject(new Error(`Django bridge exited (${code}): ${diagnostic}`));});
  const next = () => buffered.length ? Promise.resolve(buffered.shift()!) : ended ? Promise.reject(new Error(diagnostic)) : new Promise<Record<string, unknown>>((resolve, reject) => pending.push({resolve, reject}));
  const initial = await next();
  return {initial,
    request: (method: string, path: string, body?: unknown) => {
      const reply = next();
      process.stdin.write(JSON.stringify({method, path, body}) + '\n');
      return reply;
    },
    close: () => {process.stdin.end();},
  };
}
