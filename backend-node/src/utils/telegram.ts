import { config } from '../core/config';

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

/**
 * Валидирует Telegram bot token и возвращает информацию о боте
 */
export async function validateTelegramToken(
  token: string
): Promise<TelegramBotInfo | null> {
  try {
    const response = await fetch(
      `${config.telegramApiUrl}/bot${token}/getMe`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 секунд таймаут
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as TelegramApiResponse<TelegramBotInfo>;

    if (data.ok && data.result) {
      return data.result;
    }

    return null;
  } catch (error) {
    console.error('Error validating Telegram token:', error);
    return null;
  }
}

/**
 * Получает информацию о боте по токену (алиас для validateTelegramToken)
 */
export async function getBotInfo(
  token: string
): Promise<TelegramBotInfo | null> {
  return validateTelegramToken(token);
}

/**
 * Нормализует ввод канала в полный URL
 */
export function normalizeChannelUrl(channelInput: string): string {
  if (!channelInput) {
    return channelInput;
  }

  channelInput = channelInput.trim();

  // Если уже полный URL, возвращаем как есть
  if (
    channelInput.startsWith('https://t.me/') ||
    channelInput.startsWith('http://t.me/') ||
    channelInput.startsWith('https://') ||
    channelInput.startsWith('http://')
  ) {
    return channelInput;
  }

  // Если формат @username, преобразуем в https://t.me/username
  if (channelInput.startsWith('@')) {
    const username = channelInput.slice(1); // Убираем @
    return `https://t.me/${username}`;
  }

  // Если просто username без @, добавляем префикс
  if (channelInput && !channelInput.startsWith('http') && !channelInput.startsWith('@')) {
    return `https://t.me/${channelInput}`;
  }

  return channelInput;
}

/**
 * Пытается получить название канала из URL или username
 */
export async function getChannelInfo(
  channelUrl: string
): Promise<string | null> {
  try {
    if (!channelUrl) {
      return null;
    }

    // Нормализуем URL
    const normalizedUrl = normalizeChannelUrl(channelUrl);

    // Если формат @username, извлекаем username
    if (channelUrl.startsWith('@')) {
      const username = channelUrl.slice(1).trim();
      if (username) {
        // Преобразуем в читаемое название
        const readableName = username
          .replace(/_/g, ' ')
          .replace(/-/g, ' ');
        return readableName
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    // Парсим URL канала Telegram
    // Формат: https://t.me/channel_name или https://t.me/joinchat/...
    if (
      !normalizedUrl.startsWith('https://t.me/') &&
      !normalizedUrl.startsWith('http://t.me/')
    ) {
      return null;
    }

    // Извлекаем имя канала из URL
    const parts = normalizedUrl
      .replace('https://t.me/', '')
      .replace('http://t.me/', '')
      .split('/');
    if (parts.length > 0) {
      let channelName = parts[0].trim();
      // Убираем параметры запроса
      if (channelName.includes('?')) {
        channelName = channelName.split('?')[0];
      }
      if (channelName && channelName !== 'joinchat') {
        // Преобразуем в читаемое название
        const readableName = channelName.replace(/_/g, ' ').replace(/-/g, ' ');
        return readableName
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
  } catch (error) {
    console.error('Error getting channel info:', error);
  }
  return null;
}
