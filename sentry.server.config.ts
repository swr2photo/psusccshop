import * as Sentry from '@sentry/nextjs';
import {
  sentryEnvironment,
  sentryRelease,
  sentryTracesSampler,
} from './src/lib/sentry-options';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment,
    release: sentryRelease,
    sendDefaultPii: true,
    tracesSampler: sentryTracesSampler,
    includeLocalVariables: true,
    enableLogs: true,
  });
}
