/**
 * Metrics and monitoring utilities
 */

import { logger } from './logger';

interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private readonly maxMetrics = 1000;

  /**
   * Record a metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log important metrics
    if (name.includes('error') || name.includes('failure')) {
      logger.warn(`Metric: ${name}`, { value, tags });
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  /**
   * Record timing
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, { ...tags, unit: 'ms' });
  }

  /**
   * Get metrics summary
   */
  getSummary(timeWindowMs: number = 60 * 1000): Record<string, {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  }> {
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    
    const recent = this.metrics.filter(m => m.timestamp > cutoff);
    const summary: Record<string, {
      count: number;
      sum: number;
      avg: number;
      min: number;
      max: number;
    }> = {};

    for (const metric of recent) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          sum: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const stat = summary[metric.name];
      stat.count++;
      stat.sum += metric.value;
      stat.min = Math.min(stat.min, metric.value);
      stat.max = Math.max(stat.max, metric.value);
    }

    // Calculate averages
    for (const key in summary) {
      summary[key].avg = summary[key].sum / summary[key].count;
      if (summary[key].min === Infinity) summary[key].min = 0;
      if (summary[key].max === -Infinity) summary[key].max = 0;
    }

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

export const metrics = new MetricsCollector();

