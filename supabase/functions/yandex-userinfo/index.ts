const userinfoUrl = 'https://login.yandex.ru/info?format=json';
const jsonHeaders = { 'Cache-Control': 'no-store' };
function errorResponse(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: message }, { status, headers: { ...jsonHeaders, ...headers } });
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
export async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405, 'Method not allowed', { Allow: 'GET' });
  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer[ \t]+\S+$/i.test(authorization)) return errorResponse(401, 'Bearer authorization required');
  const token = authorization.replace(/^Bearer[ \t]+/i, '');
  let upstream: Response;
  try {
    upstream = await fetch(userinfoUrl, {
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    // Do not expose upstream error text: it may contain request details.
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return errorResponse(timeout ? 504 : 502, 'Yandex userinfo unavailable');
  }
  if (!upstream.ok) return errorResponse(upstream.status, 'Yandex userinfo request failed');
  let data: unknown;
  try { data = await upstream.json(); }
  catch { return errorResponse(502, 'Invalid Yandex userinfo response'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return errorResponse(502, 'Invalid Yandex userinfo response');
  const yandex = data as Record<string, unknown>;
  if (!(typeof yandex.id === 'string' && yandex.id.trim()) && !(typeof yandex.id === 'number' && Number.isFinite(yandex.id))) {
    return errorResponse(502, 'Yandex user ID missing');
  }
  const firstEmail = Array.isArray(yandex.emails) ? text(yandex.emails[0]) : undefined;
  const avatarId = text(yandex.default_avatar_id);
  return Response.json({
    sub: String(yandex.id),
    email: text(yandex.default_email) || firstEmail,
    email_verified: true,
    name: text(yandex.real_name) || text(yandex.display_name) || text(yandex.login),
    given_name: text(yandex.first_name) || '',
    family_name: text(yandex.last_name) || '',
    preferred_username: text(yandex.login) || '',
    picture: avatarId ? `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200` : null,
  }, { headers: jsonHeaders });
}
Deno.serve(handleRequest);
