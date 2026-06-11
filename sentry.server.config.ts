import * as Sentry from '@sentry/nextjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import {
  sentryAgentMonitoringOptions,
  sentryProfilingOptions,
  sentrySharedInitOptions,
  sentryTracesSampler,
} from './src/lib/sentry-options';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    ...sentrySharedInitOptions,
    ...sentryProfilingOptions,
    ...sentryAgentMonitoringOptions,
    tracesSampler: sentryTracesSampler,
    includeLocalVariables: true,
    integrations: [nodeProfilingIntegration()],
  });
}
