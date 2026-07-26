// src/lib/sentry-metrics.ts
// Helper utilities for Sentry Custom Metrics (supported in @sentry/nextjs >= 10.25.0)

import * as Sentry from '@sentry/nextjs';

/**
 * Increment a counter metric in Sentry
 */
export function recordMetricCount(name: string, value = 1): void {
  try {
    Sentry.metrics.count(name, value);
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record count metric:', error);
  }
}

/**
 * Record a distribution metric (e.g. latency, response times)
 */
export function recordMetricDistribution(
  name: string,
  value: number,
  unit?: string,
): void {
  try {
    Sentry.metrics.distribution(name, value, { unit });
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record distribution metric:', error);
  }
}

/**
 * Record a gauge metric (current value, e.g. active cart size, queue length)
 */
export function recordMetricGauge(
  name: string,
  value: number,
  unit?: string,
): void {
  try {
    Sentry.metrics.gauge(name, value, { unit });
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record gauge metric:', error);
  }
}

/**
 * Send a verification test metric to confirm Sentry Metrics are operational
 */
export function recordTestMetric(): void {
  recordMetricCount('test_metric');
}

// ============== Domain-Specific Metric Helpers ==============

/**
 * Record chatbot request metric with outcome
 */
export function recordChatbotRequest(outcome: 'success' | 'error' | 'rate_limit'): void {
  try {
    Sentry.metrics.count('chatbot_request', 1);
    Sentry.metrics.count(`chatbot_request_${outcome}`, 1);
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record chatbot metric:', error);
  }
}

/**
 * Record cron job execution metric
 */
export function recordCronRun(jobName: string, outcome: 'success' | 'failed'): void {
  try {
    Sentry.metrics.count(`cron_run_${outcome}`, 1);
    Sentry.metrics.count(`cron_run_${jobName}_${outcome}`, 1);
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record cron metric:', error);
  }
}

/**
 * Record order creation metric with duration
 */
export function recordOrderCreated(outcome: 'success' | 'failed', durationMs?: number): void {
  try {
    Sentry.metrics.count(`order_created_${outcome}`, 1);
    if (durationMs !== undefined) {
      Sentry.metrics.distribution('order_creation_duration', durationMs, { unit: 'millisecond' });
    }
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record order metric:', error);
  }
}
