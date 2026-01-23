import prisma from '../core/database';

export interface BroadcastFilters {
  new_users_days?: number;
  inactive_days?: number;
  source?: string;
  tags?: string[];
}

/**
 * Фильтрует пользователей для рассылки на основе условий
 * 
 * Поддерживаемые фильтры:
 * - new_users_days: int - новые пользователи (зарегистрировались за последние N дней)
 * - inactive_days: int - неактивные пользователи (не заходили N дней)
 * - source: str - фильтр по источнику
 * - tags: List[str] - фильтр по тегам (пользователь должен иметь все указанные теги)
 * 
 * Примечание: Рассылка всегда отправляется только активным пользователям (status='active'),
 * так как заблокированным пользователям отправить сообщение невозможно.
 */
export async function filterUsersForBroadcast(
  botId: number,
  filters: BroadcastFilters = {}
): Promise<number[]> {
  // Базовый запрос - только активные пользователи бота
  const where: any = {
    botId,
    status: 'active',
  };

  // Фильтр по новым пользователям
  if (filters.new_users_days && filters.new_users_days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.new_users_days);
    where.joinedAt = {
      gte: cutoffDate,
    };
  }

  // Фильтр по неактивным пользователям
  if (filters.inactive_days && filters.inactive_days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.inactive_days);
    where.lastActivity = {
      lt: cutoffDate,
    };
  }

  // Фильтр по источнику
  if (filters.source) {
    where.source = filters.source;
  }

  // Фильтр по тегам
  if (filters.tags && filters.tags.length > 0) {
    // Получаем ID тегов по именам
    const tagObjects = await prisma.userTag.findMany({
      where: {
        botId,
        name: { in: filters.tags },
      },
      select: { id: true },
    });

    if (tagObjects.length === 0) {
      // Если теги не найдены, возвращаем пустой список
      return [];
    }

    const tagIds = tagObjects.map((tag) => tag.id);

    // Получаем всех пользователей, соответствующих базовым условиям
    const allUsers = await prisma.telegramUser.findMany({
      where,
      include: {
        tags: {
          where: {
            id: { in: tagIds },
          },
        },
      },
    });

    // Фильтруем пользователей, у которых есть ВСЕ указанные теги
    const filteredUsers = allUsers.filter((user) => {
      const userTagIds = user.tags.map((tag) => tag.id);
      return tagIds.every((tagId) => userTagIds.includes(tagId));
    });

    return filteredUsers.map((user) => user.id);
  }

  // Если нет фильтра по тегам, просто возвращаем всех пользователей, соответствующих условиям
  const users = await prisma.telegramUser.findMany({
    where,
    select: { id: true },
  });

  return users.map((user) => user.id);
}
