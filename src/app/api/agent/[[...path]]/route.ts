import type { NextRequest } from 'next/server';
import { runtimePromise } from '../../../../agent/runtime';

async function handle(req: NextRequest): Promise<Response> {
  const runtime = await runtimePromise;

  // Walk the canonical route plan and delegate to the first match.
  for (const route of runtime.http.routes) {
    if (route.method !== req.method) continue;

    const params = matchRoute(route.path, req.nextUrl.pathname);
    if (params !== null) {
      return route.handle(req, params);
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Match a path pattern (with `:param` segments) against an actual pathname.
 * Returns null when there is no match, or a params record when matched.
 */
function matchRoute(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const ap = pathParts[i]!;

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(ap);
    } else if (pp !== ap) {
      return null;
    }
  }

  return params;
}

export const GET = handle;
export const POST = handle;

// Required for catch-all with static export safety.
export const dynamic = 'force-dynamic';
