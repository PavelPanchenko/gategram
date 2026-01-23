/**
 * Утилиты для обработки шаблонов сообщений
 */

interface TelegramUser {
  telegramUserId: bigint;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  source: string | null;
  status: string | null;
}

export function processTemplate(
  template: string,
  user: TelegramUser,
  additionalData: Record<string, any> = {}
): string {
  // Базовые переменные пользователя
  const variables: Record<string, string> = {
    user_name: user.firstName || user.username || 'Пользователь',
    user_first_name: user.firstName || '',
    user_last_name: user.lastName || '',
    user_username: user.username || '',
    user_id: user.telegramUserId.toString(),
    source: user.source || 'unknown',
    status: user.status || 'active',
  };

  // Добавляем дополнительные данные (они имеют приоритет над базовыми)
  Object.assign(variables, additionalData);

  // Заменяем переменные в формате {{variable_name}} (с учетом пробелов)
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    // Паттерн для {{key}} с возможными пробелами
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(pattern, String(value));
  }

  // Проверяем, остались ли необработанные переменные
  const remainingVars = result.match(/\{\{\s*(\w+)\s*\}\}/gi);
  if (remainingVars) {
    console.warn(
      `Variables not replaced: ${remainingVars.join(', ')}. Available variables: ${Object.keys(variables).join(', ')}`
    );
  }

  return result;
}
