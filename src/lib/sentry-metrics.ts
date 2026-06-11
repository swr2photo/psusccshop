import * as Sentry from '@sentry/nextjs';

function hasSentryDsn(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function recordOrderCreated(
  status: 'success' | 'failed',
  latencyMs?: number,
): void {
  if (!hasSentryDsn()) return;

  Sentry.metrics.count('orders_created', 1, { attributes: { status } });

  if (latencyMs !== undefined) {
    Sentry.metrics.distribution('orders_latency', latencyMs, {
      unit: 'millisecond',
      attributes: { status },
    });
  }
}

export function recordCronRun(
  job: string,
  status: 'success' | 'failed',
): void {
  if (!hasSentryDsn()) return;

  Sentry.metrics.count('cron_run', 1, {
    attributes: { job, status },
  });
}

export function recordChatbotRequest(status: 'success' | 'error' | 'rate_limit'): void {
  if (!hasSentryDsn()) return;

  Sentry.metrics.count('chatbot_requests', 1, {
    attributes: { status },
  });
}

/** Dev verification — call once to confirm metrics reach Sentry. */
export function recordTestMetric(): void {
  if (!hasSentryDsn()) return;
  Sentry.metrics.count('test_metric', 1);
}
