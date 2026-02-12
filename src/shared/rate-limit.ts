// Rate limit configuration shape — no enforcement logic in Phase 1

export interface RateLimitConfig {
  /** Maximum number of requests permitted within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export type ToolRateLimits = Record<string, RateLimitConfig | undefined>;
