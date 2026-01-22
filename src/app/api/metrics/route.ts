/**
 * Metrics endpoint for monitoring
 */

import { NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';
import { cache } from '@/lib/cache';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const metricsSummary = metrics.getSummary(60 * 1000); // Last minute
    const cacheStats = cache.getStats();

    return NextResponse.json({
      metrics: metricsSummary,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}

