/**
 * Health check endpoint for monitoring
 */

import { NextResponse } from 'next/server';
import { isAIAvailable } from '@/lib/config';
import { logger } from '@/lib/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    api: 'ok' | 'error';
    ai: 'available' | 'unavailable';
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  version: string;
}

/**
 * Get memory usage (Node.js)
 */
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      used: Math.round(usage.heapUsed / 1024 / 1024), // MB
      total: Math.round(usage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    };
  }
  return { used: 0, total: 0, percentage: 0 };
}

export async function GET() {
  try {
    const memory = getMemoryUsage();
    const aiAvailable = isAIAvailable();
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Degraded if AI is unavailable but API works
    if (!aiAvailable) {
      status = 'degraded';
    }
    
    // Unhealthy if memory usage is too high (>90%)
    if (memory.percentage > 90) {
      status = 'unhealthy';
      logger.warn('High memory usage detected', { memory });
    }
    
    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        ai: aiAvailable ? 'available' : 'unavailable',
        memory,
      },
      version: process.env.npm_package_version || '0.1.0',
    };
    
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (error) {
    logger.error('Health check failed', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}

