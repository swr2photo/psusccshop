/** Standard JSON response helpers for Elysia routes. */

export function jsonBody(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });
}

export function jsonError(message: string, status = 400) {
  return jsonBody({ status: 'error', message }, { status });
}

export function authError(result: { ok: false; status: number; message: string }) {
  return jsonError(result.message, result.status);
}
