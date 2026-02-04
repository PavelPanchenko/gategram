/**
 * Сервис для обработки автоматических триггеров
 */

import prisma from '../core/database';
import { botManager } from '../services/botManager';
import { processTemplate } from './templateProcessor';

export enum TriggerEvent {
  USER_REGISTERED = 'user_registered',
  USER_JOINED_CHANNEL = 'user_joined_channel',
  USER_LEFT_CHANNEL = 'user_left_channel',
  USER_INACTIVE = 'user_inactive',
}

export enum TriggerAction {
  SEND_MESSAGE = 'send_message',
  ADD_TAG = 'add_tag',
  REMOVE_TAG = 'remove_tag',
}

export async function processTriggerEvent(
  eventType: string,
  botId: number,
  telegramUserId: number | null = null,
  data: Record<string, any> = {}
): Promise<void> {
  const triggers = await prisma.trigger.findMany({
    where: {
      botId,
      eventType,
      isActive: true,
    },
  });

  if (triggers.length === 0) {
    return;
  }

  for (const trigger of triggers) {
    try {
      if (!(await checkConditions(trigger, telegramUserId, data))) {
        continue;
      }

      await executeActions(trigger, botId, telegramUserId, data);
    } catch (error) {
      console.error(`Error processing trigger ${trigger.id}:`, error);
    }
  }
}

async function checkConditions(
  trigger: any,
  telegramUserId: number | null,
  data: Record<string, any>
): Promise<boolean> {
  const conditions = (trigger.conditions as Record<string, any>) || {};

  // Если нет условий, триггер срабатывает всегда
  if (Object.keys(conditions).length === 0) {
    return true;
  }

  // Проверка на неактивность пользователя
  if (conditions.days_inactive) {
    if (!telegramUserId) {
      return false;
    }

    const user = await prisma.telegramUser.findFirst({
      where: {
        telegramUserId: BigInt(telegramUserId),
        botId: trigger.botId,
      },
    });

    if (!user) {
      return false;
    }

    const daysInactive =
      (Date.now() - user.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysInactive < conditions.days_inactive) {
      return false;
    }
  }

  // Проверка источника
  if (conditions.source) {
    if (!telegramUserId) {
      return false;
    }

    const user = await prisma.telegramUser.findFirst({
      where: {
        telegramUserId: BigInt(telegramUserId),
        botId: trigger.botId,
      },
    });

    if (!user || user.source !== conditions.source) {
      return false;
    }
  }

  // Проверка тегов
  if (conditions.tags && Array.isArray(conditions.tags)) {
    if (!telegramUserId) {
      return false;
    }

    const user = await prisma.telegramUser.findFirst({
      where: {
        telegramUserId: BigInt(telegramUserId),
        botId: trigger.botId,
      },
      include: {
        tags: true,
      },
    });

    if (!user) {
      return false;
    }

    const userTagNames = new Set(user.tags.map((tag) => tag.name));
    const requiredTags = new Set(conditions.tags);

    // Проверяем, что все требуемые теги есть у пользователя
    for (const requiredTag of requiredTags) {
      if (!userTagNames.has(requiredTag)) {
        return false;
      }
    }
  }

  return true;
}

async function executeActions(
  trigger: any,
  botId: number,
  telegramUserId: number | null,
  data: Record<string, any>
): Promise<void> {
  // Проверяем новое поле actions (правильный формат)
  const actions = (trigger.actions as any[]) || [];

  if (actions.length > 0) {
    for (let idx = 0; idx < actions.length; idx++) {
      const action = actions[idx];
      const actionType = action.type;
      const actionParams = action.data || {};

      if (actionType === TriggerAction.SEND_MESSAGE) {
        await sendMessageAction(trigger, botId, telegramUserId, actionParams, data);
      } else if (actionType === TriggerAction.ADD_TAG) {
        await addTagAction(trigger, botId, telegramUserId, actionParams);
      } else if (actionType === TriggerAction.REMOVE_TAG) {
        await removeTagAction(trigger, botId, telegramUserId, actionParams);
      }
    }
  } else {
    const actionData = (trigger.actionData as Record<string, any>) || {};

    if (trigger.actionType === TriggerAction.SEND_MESSAGE) {
      await sendMessageAction(trigger, botId, telegramUserId, actionData, data);
    } else if (trigger.actionType === TriggerAction.ADD_TAG) {
      await addTagAction(trigger, botId, telegramUserId, actionData);
    } else if (trigger.actionType === TriggerAction.REMOVE_TAG) {
      await removeTagAction(trigger, botId, telegramUserId, actionData);
    }
  }
}

async function sendMessageAction(
  trigger: any,
  botId: number,
  telegramUserId: number | null,
  actionData: Record<string, any>,
  eventData: Record<string, any>
): Promise<void> {
  if (!telegramUserId) {
    return;
  }

  const botInstance = botManager.getBot(botId);
  if (!botInstance) {
    console.warn(`Bot ${botId} is not running, cannot send message`);
    return;
  }

  // Получаем текст сообщения
  let messageText = actionData.message || '';

  // Если указан template_id, используем шаблон
  if (actionData.template_id) {
    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: actionData.template_id,
        botId,
      },
    });

    if (template) {
      const user = await prisma.telegramUser.findFirst({
        where: {
          telegramUserId: BigInt(telegramUserId),
          botId,
        },
      });

      if (user) {
        messageText = processTemplate(template.content as string, user, eventData);
      }
    }
  }

  try {
    await botInstance.api.sendMessage(telegramUserId, messageText);
  } catch (error) {
    console.error(`Failed to send message to user ${telegramUserId}:`, error);
  }
}

async function addTagAction(
  trigger: any,
  botId: number,
  telegramUserId: number | null,
  actionData: Record<string, any>
): Promise<void> {
  if (!telegramUserId) {
    return;
  }

  const tagId = actionData.tag_id;
  if (!tagId) {
    return;
  }

  const user = await prisma.telegramUser.findFirst({
    where: {
      telegramUserId: BigInt(telegramUserId),
      botId,
    },
    include: {
      tags: true,
    },
  });

  if (!user) {
    return;
  }

  const tag = await prisma.userTag.findFirst({
    where: {
      id: tagId,
      botId,
    },
  });

  if (tag) {
    const hasTag = user.tags.some((t) => t.id === tagId);
    if (!hasTag) {
      await prisma.telegramUser.update({
        where: { id: user.id },
        data: {
          tags: {
            connect: { id: tagId },
          },
        },
      });
    }
  }
}

async function removeTagAction(
  trigger: any,
  botId: number,
  telegramUserId: number | null,
  actionData: Record<string, any>
): Promise<void> {
  if (!telegramUserId) {
    return;
  }

  const tagId = actionData.tag_id;
  if (!tagId) {
    return;
  }

  const user = await prisma.telegramUser.findFirst({
    where: {
      telegramUserId: BigInt(telegramUserId),
      botId,
    },
    include: {
      tags: true,
    },
  });

  if (!user) {
    return;
  }

  const tag = await prisma.userTag.findFirst({
    where: {
      id: tagId,
      botId,
    },
  });

  if (tag) {
    const hasTag = user.tags.some((t) => t.id === tagId);
    if (hasTag) {
      await prisma.telegramUser.update({
        where: { id: user.id },
        data: {
          tags: {
            disconnect: { id: tagId },
          },
        },
      });
    }
  }
}
