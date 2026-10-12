let callbackMessage: string | null = null;

// Error text and tokens supplied in the callback are never rendered or logged.
export function oauthFailure(raw: string): { url: string; message: string } | null {
  const url = new URL(raw);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get('error') ?? hash.get('error');
  if (!code) return null;
  for (const key of ['error', 'error_code', 'error_description', 'state', 'code', 'access_token', 'refresh_token', 'id_token', 'provider_token', 'provider_refresh_token']) url.searchParams.delete(key);
  url.hash = '/login';
  return {
    url: url.href,
    message: code === 'access_denied' ? 'Вход отменён. Можно попробовать снова или продолжить без входа.' : 'Не удалось подтвердить вход. Попробуйте снова.',
  };
}

export function captureOAuthFailure() {
  const failure = oauthFailure(window.location.href);
  if (!failure) return;
  callbackMessage = failure.message;
  window.history.replaceState(window.history.state, '', failure.url);
}

export const getOAuthCallbackMessage = () => callbackMessage;
