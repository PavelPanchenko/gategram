/**
 * Скрывает токены ботов Telegram (например, в URL https://api.telegram.org/bot<token>/getMe),
 * чтобы они не попадали в логи и уведомления.
 */
export function redactBotTokens(text: string): string {
  return text.replace(/(?<!\d)\d{8,12}:[A-Za-z0-9_-]{30,}/g, '[REDACTED_TOKEN]');
}

/** Короткое описание ошибки без токенов — для console.error вместо целого объекта ошибки */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return redactBotTokens(String(error));
  const parts = [`${error.name}: ${error.message}`];
  const cause = (error as { error?: unknown; cause?: unknown }).error ?? error.cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    parts.push(`cause: ${cause.message}${code ? ` (${code})` : ''}`);
  }
  return redactBotTokens(parts.join('; '));
}
