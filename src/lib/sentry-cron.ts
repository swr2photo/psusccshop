import * as Sentry from '@sentry/nextjs';

type CronMonitorOptions = {
  monitorSlug: string;
  schedule: string;
  maxRuntime?: number;
};

export async function withCronMonitor<T>(
  { monitorSlug, schedule, maxRuntime = 30 }: CronMonitorOptions,
  fn: () => Promise<T>
): Promise<T> {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return fn();
  }

  return Sentry.withMonitor(
    monitorSlug,
    fn,
    {
      schedule: { type: 'crontab', value: schedule },
      checkinMargin: 5,
      maxRuntime,
    }
  );
}
