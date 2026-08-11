/**
 * Периодическая проверка frontend + API health.
 * Алерты через те же UserNotificationSettings, что и бизнес-ошибки.
 */

import { config } from '../core/config';
import { notifyAllEnabledOwners } from './errorNotifier';

type CheckResult = { ok: true } | { ok: false; detail: string };

const previousOk = new Map<string, boolean>();

async function fetchHealth(url: string, timeoutMs = 8000): Promise<CheckResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    const status = body?.status?.toLowerCase();
    if (status && status !== 'ok' && status !== 'healthy') {
      return { ok: false, detail: `status=${body?.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkTarget(name: string, url: string): Promise<void> {
  const result = await fetchHealth(url);
  const wasOk = previousOk.get(name);
  previousOk.set(name, result.ok);

  if (!result.ok) {
    await notifyAllEnabledOwners({
      source: `health ${name}`,
      message: `${name} недоступен: ${result.detail}`,
      meta: { url },
    });
    return;
  }

  // Сообщение о восстановлении только после известного сбоя
  if (wasOk === false) {
    await notifyAllEnabledOwners({
      source: `health ${name}`,
      message: `${name} снова доступен`,
      level: 'info',
      meta: { url },
    });
  }
}

export async function runHealthChecks(): Promise<void> {
  const targets: Array<{ name: string; url: string }> = [
    { name: 'frontend', url: config.frontendHealthUrl },
    { name: 'api', url: config.apiHealthUrl },
  ];

  for (const t of targets) {
    try {
      await checkTarget(t.name, t.url);
    } catch (err) {
      console.error(`healthWatcher ${t.name}:`, err instanceof Error ? err.message : err);
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startHealthWatcher(): void {
  if (timer) return;
  if (!config.healthCheckEnabled) {
    console.log('⏭️  Health watcher disabled');
    return;
  }

  const interval = config.healthCheckIntervalMs;
  console.log(
    `✅ Health watcher enabled (every ${Math.round(interval / 1000)}s): frontend=${config.frontendHealthUrl}, api=${config.apiHealthUrl}`
  );

  // Первая проверка с задержкой, чтобы сервисы успели подняться
  setTimeout(() => {
    void runHealthChecks();
  }, Math.min(interval, 30_000));

  timer = setInterval(() => {
    void runHealthChecks();
  }, interval);
}

export function stopHealthWatcher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
