/**
 * Rate limiting utilities
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (in production, use Redis or similar)
const rateLimitStore: RateLimitStore = {};

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export const RATE_LIMITS = {
  // General API requests
  API: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per minute
  // File uploads (more restrictive)
  UPLOAD: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 uploads per minute
  // AI analysis (most restrictive due to cost)
  AI: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 AI requests per minute
  // Batch operations
  BATCH: { windowMs: 5 * 60 * 1000, maxRequests: 3 }, // 3 batches per 5 minutes
} as const;

/**
 * Get client identifier from request
 */
export function getClientId(request: Request): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  return ip.trim();
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = `${clientId}:${config.windowMs}`;
  
  const record = rateLimitStore[key];
  
  // Clean up old records periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    Object.keys(rateLimitStore).forEach(k => {
      if (rateLimitStore[k].resetTime < now) {
        delete rateLimitStore[k];
      }
    });
  }
  
  if (!record || record.resetTime < now) {
    // Create new record
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  // Increment count
  record.count++;
  
  if (record.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const clientId = getClientId(request);
    const result = checkRateLimit(clientId, config);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_ERROR',
            message: 'Too many requests. Please try again later.',
            details: {
              resetTime: new Date(result.resetTime).toISOString(),
            },
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // Add rate limit headers to response
    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetTime.toString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

