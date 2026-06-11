import type { SamplingContext } from '@sentry/core';
import pkg from '../../package.json';
import {
  sentryBeforeSend,
  sentryIgnoredErrors,
} from './sentry-error-filters';

const isDev = process.env.NODE_ENV === 'development';

export const sentryRelease =
  process.env.SENTRY_RELEASE ||
  process.env.NEXT_PUBLIC_BUILD_VERSION ||
  `psuscc-shop@${pkg.version}`;

export const sentryTracesSampleRate = isDev ? 1.0 : 0.1;

export const sentryReplaySessionSampleRate = isDev ? 1.0 : 0.1;

export const sentryProfileSessionSampleRate = isDev ? 1.0 : 0.1;

export const sentryProfilingOptions = {
  profileSessionSampleRate: sentryProfileSessionSampleRate,
  profileLifecycle: 'trace' as const,
};

export const sentryAgentMonitoringOptions = {
  streamGenAiSpans: true,
  dataCollection: {
    genAI: {
      inputs: true,
      outputs: true,
    },
  },
} as const;

export const sentryEnvironment =
  process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV;

export const sentrySharedInitOptions = {
  environment: sentryEnvironment,
  release: sentryRelease,
  sendDefaultPii: true,
  enableLogs: true,
  enableMetrics: true,
  ignoreErrors: sentryIgnoredErrors,
  beforeSend: sentryBeforeSend,
};

export function sentryTracesSampler({
  name,
  inheritOrSampleWith,
}: SamplingContext): number | boolean {
  const normalized = name.toLowerCase();

  if (normalized.includes('health') || normalized.includes('/live')) {
    return 0;
  }

  if (
    normalized.includes('/payment') ||
    normalized.includes('/checkout') ||
    normalized.includes('/api/payment') ||
    normalized.includes('/api/orders') ||
    normalized.includes('/api/cart')
  ) {
    return 1.0;
  }

  if (normalized.includes('/admin')) {
    return 0.5;
  }

  return inheritOrSampleWith(sentryTracesSampleRate);
}
