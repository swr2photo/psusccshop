import * as Sentry from '@sentry/nextjs';
import {
  sentryProfilingOptions,
  sentryReplaySessionSampleRate,
  sentrySharedInitOptions,
  sentryTracesSampler,
} from './src/lib/sentry-options';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    ...sentrySharedInitOptions,
    ...sentryProfilingOptions,
    tracesSampler: sentryTracesSampler,
    replaysSessionSampleRate: sentryReplaySessionSampleRate,
    replaysOnErrorSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^\//],
    integrations: [
      Sentry.browserTracingIntegration({
        shouldCreateSpanForRequest: (url) =>
          !url.includes('/api/live') && !url.includes('/health'),
      }),
      Sentry.browserProfilingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        mask: ['[data-sentry-mask]', '.payment-form', '#card-element'],
        block: ['[data-sentry-block]', '.StripeElement', 'iframe[src*="stripe"]'],
        networkDetailDenyUrls: [
          '/api/auth',
          '/api/payment',
          '/api/profile',
          /\/api\/payment\//,
        ],
      }),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
