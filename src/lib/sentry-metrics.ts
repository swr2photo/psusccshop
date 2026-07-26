// src/lib/sentry-metrics.ts
// Helper utilities for Sentry Custom Metrics (supported in @sentry/nextjs >= 10.25.0)

import * as Sentry from '@sentry/nextjs';

export interface MetricTags {
  [key: string]: string | number | boolean;
}

/**
 * Increment a counter metric in Sentry
 * Example: recordMetricCount('order_checkout_success', 1, { shop: 'psuscc' })
 */
export function recordMetricCount(name: string, value = 1, tags?: MetricTags): void {
  try {
    Sentry.metrics.count(name, value, { tags });
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record count metric:', error);
  }
}

/**
 * Record a distribution metric (e.g. latency, response times, item counts)
 * Example: recordMetricDistribution('api_response_time', 120, 'millisecond')
 */
export function recordMetricDistribution(
  name: string,
  value: number,
  unit?: string,
  tags?: MetricTags,
): void {
  try {
    Sentry.metrics.distribution(name, value, { unit, tags });
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record distribution metric:', error);
  }
}

/**
 * Record a gauge metric (current value, e.g. active cart size, queue length)
 * Example: recordMetricGauge('cart_items_count', 3)
 */
export function recordMetricGauge(
  name: string,
  value: number,
  unit?: string,
  tags?: MetricTags,
): void {
  try {
    Sentry.metrics.gauge(name, value, { unit, tags });
  } catch (error) {
    console.warn('[Sentry Metrics] Failed to record gauge metric:', error);
  }
}

/**
 * Send a verification test metric to confirm Sentry Metrics are operational
 */
export function recordTestMetric(): void {
  recordMetricCount('test_metric', 1, { environment: process.env.NODE_ENV || 'development' });
}
