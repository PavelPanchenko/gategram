/**
 * Обработчики для Telegram ботов
 */

import { Bot, Context, GrammyError, InlineKeyboard } from 'grammy';
import prisma from '../core/database';
import { processTriggerEvent, TriggerEvent } from '../utils/triggerProcessor';
import { processTemplate } from '../utils/templateProcessor';
import { botManager } from './botManager';

/** 403 от Telegram, когда пользователь заблокировал бота — не логируем стек, только помечаем в БД */
function isBlockedByUserError(err: unknown): boolean {
  if (err instanceof GrammyError) {
    return err.error_code === 403 && (err.description?.includes('blocked by the user') ?? false);
  }
  const e = err as { error_code?: number; description?: string } | null;
  return !!(e && e.error_code === 403 && String(e.description || '').includes('blocked by the user'));
}

/** 400 от Telegram: callback query истёк — не логируем как ошибку */
function isCallbackQueryExpiredError(err: unknown): boolean {
  const e = err as { error_code?: number; description?: string } | null;
  return !!(e && e.error_code === 400 && String(e.description || '').toLowerCase().includes('query is too old'));
}

async function markUserBlockedIfNeeded(
  err: unknown,
  botId: number,
  userId: number | undefined
): Promise<boolean> {
  if (!isBlockedByUserError(err) || userId == null) return false;
  await prisma.telegramUser.updateMany({
    where: { botId, telegramUserId: BigInt(userId) },
    data: { status: 'blocked', lastActivity: new Date() },
  });
  return true;
}

type UiLocale = 'ru' | 'en';
function getUiLocale(ctx: Context): UiLocale {
  const lang = (ctx.from?.language_code || '').toLowerCase();
  // Telegram language_code usually like: 'ru', 'en', 'uk', 'en-US'
  if (lang.startsWith('ru') || lang.startsWith('uk') || lang.startsWith('be')) return 'ru';
  return 'en';
}

const UI_TEXT: Record<UiLocale, {
  channelsIntro: string;
  thanks: string;
  channelsNotConfigured: string;
  chooseChannel: string;
}> = {
  ru: {
    channelsIntro: 'Отлично! Вот ссылки на наши каналы:',
    thanks: 'Спасибо за взаимодействие!',
    channelsNotConfigured: 'Каналы не настроены.',
    chooseChannel: 'Выберите канал:',
  },
  en: {
    channelsIntro: "Great! Here are links to our channels:",
    thanks: 'Thanks for your interaction!',
    channelsNotConfigured: 'No channels configured.',
    chooseChannel: 'Choose a channel:',
  },
};

function getBotUiText(settings: unknown, locale: UiLocale) {
  const base = UI_TEXT[locale];
  const s: any = settings && typeof settings === 'object' ? settings : {};
  // поддерживаем несколько вариантов ключей, чтобы мигрировать без боли
  const ui =
    s.ui_texts?.[locale] ??
    s.uiTexts?.[locale] ??
    s.ui_text?.[locale] ??
    s.uiText?.[locale] ??
    {};

  return {
    channelsIntro: String(ui.channelsIntro ?? ui.channels_intro ?? base.channelsIntro),
    thanks: String(ui.thanks ?? base.thanks),
    channelsNotConfigured: String(
      ui.channelsNotConfigured ?? ui.channels_not_configured ?? base.channelsNotConfigured
    ),
    chooseChannel: String(ui.chooseChannel ?? ui.choose_channel ?? base.chooseChannel),
  };
}

// Глобальный словарь для отслеживания обрабатываемых команд /start
// Ключ: `${botId}_${userId}`, Значение: timestamp последней обработки
const processingStartCommands: Map<string, number> = new Map();
const START_COMMAND_COOLDOWN = 3000; // 3 секунды в миллисекундах

// Периодически очищаем старые записи
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processingStartCommands.entries()) {
    if (now - timestamp > START_COMMAND_COOLDOWN * 2) {
      processingStartCommands.delete(key);
    }
  }
}, 60000); // Проверяем каждую минуту

/**
 * Настраивает обработчики для конкретного бота
 */
export function setupBotHandlers(bot: Bot, botId: number): void {
  // Обработчик команды /start
  bot.command('start', async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const commandKey = `${botId}_${userId}`;
    const now = Date.now();

    // Проверяем антифлуд
    if (processingStartCommands.has(commandKey)) {
      const lastProcessed = processingStartCommands.get(commandKey)!;
      const timeDiff = now - lastProcessed;
      if (timeDiff < START_COMMAND_COOLDOWN) {
        return;
      }
    }

    // Помечаем, что обрабатываем этот запрос
    processingStartCommands.set(commandKey, now);

    try {
      // Получаем бота из БД
      const botData = await prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!botData) {
        await ctx.reply('Бот не найден');
        return;
      }

      // Проверяем, что бот активен
      if (!botData.isActive) {
        await ctx.reply('Бот временно недоступен');
        return;
      }

      const username = ctx.from.username || null;
      const firstName = ctx.from.first_name || null;
      const lastName = ctx.from.last_name || null;

      // Извлекаем source из параметров команды /start
      // В ссылке используется короткий code (лимит Telegram 64 символа); по нему находим полное название источника
      let source: string | null = null;
      if (ctx.message?.text) {
        const parts = ctx.message.text.split(' ');
        if (parts.length > 1) {
          let payload: string;
          try {
            payload = decodeURIComponent(parts[1]);
          } catch {
            payload = parts[1];
          }
          // Сначала пробуем найти реферальную ссылку по коду (короткий code в URL)
          const byCode = await prisma.referralLink.findFirst({
            where: { botId, code: payload },
            select: { source: true },
          });
          if (byCode) {
            source = byCode.source;
          } else {
            // Старый формат: start=r123 → id реферальной ссылки 123
            const rIdMatch = /^r(\d+)$/.exec(payload);
            if (rIdMatch) {
              const refLink = await prisma.referralLink.findFirst({
                where: { botId, id: parseInt(rIdMatch[1], 10) },
                select: { source: true },
              });
              if (refLink) source = refLink.source;
            }
          }
          // Если не нашли по коду — считаем payload сырым источником (обратная совместимость)
          if (source === null && payload) {
            source = payload;
            const webPrefixes = ['tgchat', 'web', 'webkiev', 'android', 'ios'];
            if (source.includes('_')) {
              const sourceParts = source.split('_');
              if (webPrefixes.includes(sourceParts[0])) {
                source = sourceParts.length > 2 ? sourceParts.slice(2).join('_') : null;
              }
            }
          }
        }
      }

      // Проверяем, существует ли пользователь
      let telegramUser = await prisma.telegramUser.findFirst({
        where: {
          botId,
          telegramUserId: BigInt(userId),
        },
      });

      let isNewUser = false;
      if (!telegramUser) {
        // Создаем нового пользователя
        isNewUser = true;
        telegramUser = await prisma.telegramUser.create({
          data: {
            botId,
            telegramUserId: BigInt(userId),
            username,
            firstName,
            lastName,
            source,
            status: 'active',
            joinedAt: new Date(),
            lastActivity: new Date(),
          },
        });
      } else {
        // Обновляем информацию
        // Если пришел source, обновляем его (даже если у пользователя уже был source)
        // Это позволяет обновить source при повторном переходе по реферальной ссылке
        const updateData: any = {
          username,
          firstName,
          lastName,
          lastActivity: new Date(),
          ...(telegramUser.status === 'blocked' || telegramUser.status === 'left'
            ? { status: 'active' }
            : {}),
        };
        
        // Обновляем source, если он был передан
        if (source !== null) {
          updateData.source = source;
        }
        
        telegramUser = await prisma.telegramUser.update({
          where: { id: telegramUser.id },
          data: updateData,
        });
      }

      // Обрабатываем триггеры для нового пользователя
      if (isNewUser) {
        await processTriggerEvent(TriggerEvent.USER_REGISTERED, botId, userId, {
          source: source || 'unknown',
        });
      }

      // Отправляем welcome message
      let welcomeText = 'Добро пожаловать!';

      // Проверяем, есть ли активный шаблон
      const template = await prisma.messageTemplate.findFirst({
        where: {
          botId,
          isActive: true,
          name: {
            contains: 'welcome',
            mode: 'insensitive',
          },
        },
      });

      if (template) {
        welcomeText = processTemplate(template.content, telegramUser, {
          source: source || 'unknown',
        });
      } else if (botData.welcomeMessage) {
        welcomeText = processTemplate(botData.welcomeMessage as string, telegramUser, {
          source: source || 'unknown',
        });
      }

      // Получаем список каналов
      const channels = (botData.channels as Array<{ name: string; url: string }>) || [];
      const channelLink = botData.channelLink as string | null;
      if (channelLink && !channels.some((ch) => ch.url === channelLink)) {
        channels.push({ name: 'Канал', url: channelLink });
      }

      // Логика отображения кнопок
      if (botData.requiredInteraction && channels.length > 0) {
        // Если требуется взаимодействие и есть каналы - показываем ТОЛЬКО кнопку "Продолжить"
        const continueText = (botData.continueButtonText as string) || '✅ Продолжить';
        const keyboard = new InlineKeyboard().text(continueText, 'continue');
        await ctx.reply(welcomeText, { reply_markup: keyboard });
      } else if (channels.length > 0) {
        // Немедленный доступ к каналам (без кнопки "Продолжить")
        const keyboard = new InlineKeyboard();
        for (const channel of channels) {
          keyboard.url(`📢 ${channel.name}`, channel.url).row();
        }
        await ctx.reply(welcomeText, { reply_markup: keyboard });
      } else {
        // Просто приветствие без каналов
        await ctx.reply(welcomeText);
      }
    } catch (error) {
      if (await markUserBlockedIfNeeded(error, botId, ctx.from?.id)) return;
      console.error(`Error in cmd_start for bot ${botId}:`, error);
      try {
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
      } catch (sendError) {
        if (!isBlockedByUserError(sendError)) {
          console.error(`Failed to send error message to user ${ctx.from?.id}:`, sendError);
        }
      }
    }
  });

  // Обработчик кнопки 'Продолжить'
  bot.callbackQuery('continue', async (ctx: Context) => {
    try {
      const botData = await prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!botData || !botData.isActive) {
        await ctx.answerCallbackQuery({ text: 'Бот временно недоступен', show_alert: true });
        return;
      }

      // Обновляем активность пользователя
      const userId = ctx.from?.id;
      if (userId) {
        await prisma.telegramUser.updateMany({
          where: {
            botId,
            telegramUserId: BigInt(userId),
          },
          data: {
            lastActivity: new Date(),
          },
        });
      }

      // Удаляем сообщение с кнопкой "Продолжить"
      try {
        await ctx.deleteMessage();
      } catch {
        // Игнорируем ошибки удаления
      }

      // Если есть задержка, ждем
      if (botData.interactionDelaySeconds > 0) {
        await ctx.answerCallbackQuery('Обрабатываем запрос...');
        await new Promise((resolve) =>
          setTimeout(resolve, botData.interactionDelaySeconds * 1000)
        );
      } else {
        await ctx.answerCallbackQuery();
      }

      // Получаем список каналов
      const channels = (botData.channels as Array<{ name: string; url: string }>) || [];
      const channelLink = botData.channelLink as string | null;
      if (channelLink && !channels.some((ch) => ch.url === channelLink)) {
        channels.push({ name: 'Канал', url: channelLink });
      }

      // Отправляем НОВОЕ сообщение со ссылками на каналы
      if (channels.length > 0) {
        const t = getBotUiText((botData as any).settings, getUiLocale(ctx));
        const keyboard = new InlineKeyboard();
        for (const channel of channels) {
          keyboard.url(`📢 ${channel.name}`, channel.url).row();
        }
        await ctx.reply(t.channelsIntro, { reply_markup: keyboard });
      } else {
        const t = getBotUiText((botData as any).settings, getUiLocale(ctx));
        await ctx.reply(t.thanks);
      }
    } catch (error) {
      if (await markUserBlockedIfNeeded(error, botId, ctx.from?.id)) return;
      if (isCallbackQueryExpiredError(error)) return;
      console.error(`Error in process_continue for bot ${botId}:`, error);
      try {
        await ctx.answerCallbackQuery({ text: 'Произошла ошибка', show_alert: true });
      } catch {
        // callback уже истёк или другая ошибка — игнорируем
      }
    }
  });

  // Обработчик команды для показа каналов
  bot.command(['channels', 'каналы', 'канал'], async (ctx: Context) => {
    try {
      const botData = await prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!botData || !botData.isActive) {
        return;
      }

      // Получаем список каналов
      const channels = (botData.channels as Array<{ name: string; url: string }>) || [];
      const channelLink = botData.channelLink as string | null;
      if (channelLink && !channels.some((ch) => ch.url === channelLink)) {
        channels.push({ name: 'Канал', url: channelLink });
      }

      if (channels.length === 0) {
        const t = getBotUiText((botData as any).settings, getUiLocale(ctx));
        await ctx.reply(t.channelsNotConfigured);
        return;
      }

      // Создаем клавиатуру с каналами
      const keyboard = new InlineKeyboard();
      for (const channel of channels) {
        keyboard.url(`📢 ${channel.name}`, channel.url).row();
      }

      const t = getBotUiText((botData as any).settings, getUiLocale(ctx));
      await ctx.reply(t.chooseChannel, { reply_markup: keyboard });
    } catch (error) {
      if (await markUserBlockedIfNeeded(error, botId, ctx.from?.id)) return;
      console.error(`Error in cmd_channels for bot ${botId}:`, error);
    }
  });

  // Обработчик всех остальных сообщений
  bot.on('message', async (ctx: Context) => {
    try {
      const botData = await prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!botData || !botData.isActive) {
        return;
      }

      const userId = ctx.from?.id;
      if (!userId) return;

      const username = ctx.from.username || null;
      const firstName = ctx.from.first_name || null;
      const lastName = ctx.from.last_name || null;

      // Проверяем, существует ли пользователь
      let telegramUser = await prisma.telegramUser.findFirst({
        where: {
          botId,
          telegramUserId: BigInt(userId),
        },
      });

      let isNewUser = false;
      if (!telegramUser) {
        // Создаем нового пользователя
        isNewUser = true;
        telegramUser = await prisma.telegramUser.create({
          data: {
            botId,
            telegramUserId: BigInt(userId),
            username,
            firstName,
            lastName,
            source: null,
            status: 'active',
            joinedAt: new Date(),
            lastActivity: new Date(),
          },
        });
      } else {
        // Обновляем информацию
        telegramUser = await prisma.telegramUser.update({
          where: { id: telegramUser.id },
          data: {
            username,
            firstName,
            lastName,
            lastActivity: new Date(),
            ...(telegramUser.status === 'blocked' || telegramUser.status === 'left'
              ? { status: 'active' }
              : {}),
          },
        });
      }

      // Обрабатываем триггеры для нового пользователя
      if (isNewUser) {
        await processTriggerEvent(TriggerEvent.USER_REGISTERED, botId, userId, {});
      }

      // Всегда отправляем приветственное сообщение
      let welcomeText = 'Добро пожаловать!';

      const template = await prisma.messageTemplate.findFirst({
        where: {
          botId,
          isActive: true,
          name: {
            contains: 'welcome',
            mode: 'insensitive',
          },
        },
      });

      if (template) {
        welcomeText = processTemplate(template.content, telegramUser, {});
      } else if (botData.welcomeMessage) {
        welcomeText = processTemplate(botData.welcomeMessage as string, telegramUser, {});
      }

      // Получаем список каналов
      const channels = (botData.channels as Array<{ name: string; url: string }>) || [];
      const channelLink = botData.channelLink as string | null;
      if (channelLink && !channels.some((ch) => ch.url === channelLink)) {
        channels.push({ name: 'Канал', url: channelLink });
      }

      // Логика отображения кнопок (такая же как в /start)
      if (botData.requiredInteraction && channels.length > 0) {
        const continueText = (botData.continueButtonText as string) || '✅ Продолжить';
        const keyboard = new InlineKeyboard().text(continueText, 'continue');
        await ctx.reply(welcomeText, { reply_markup: keyboard });
      } else if (channels.length > 0) {
        const keyboard = new InlineKeyboard();
        for (const channel of channels) {
          keyboard.url(`📢 ${channel.name}`, channel.url).row();
        }
        await ctx.reply(welcomeText, { reply_markup: keyboard });
      } else {
        await ctx.reply(welcomeText);
      }
    } catch (error) {
      if (await markUserBlockedIfNeeded(error, botId, ctx.from?.id)) return;
      console.error(`Error in handle_message for bot ${botId}:`, error);
    }
  });

  // Обработчик события блокировки/разблокировки бота пользователем
  bot.on('my_chat_member', async (ctx: Context) => {
    try {
      const update = ctx.myChatMember;
      if (!update) return;

      const userId = update.from.id;
      const oldStatus = update.old_chat_member.status;
      const newStatus = update.new_chat_member.status;

      // Если пользователь заблокировал бота
      if (newStatus === 'kicked' || newStatus === 'left') {
        await prisma.telegramUser.updateMany({
          where: {
            botId,
            telegramUserId: BigInt(userId),
          },
          data: {
            status: 'blocked',
            lastActivity: new Date(),
          },
        });
      }
      // Если пользователь разблокировал бота
      else if (newStatus === 'member' && (oldStatus === 'kicked' || oldStatus === 'left')) {
        await prisma.telegramUser.updateMany({
          where: {
            botId,
            telegramUserId: BigInt(userId),
          },
          data: {
            status: 'active',
            lastActivity: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Error in handle_my_chat_member for bot ${botId}:`, error);
    }
  });

  // Обработчик события присоединения пользователя к каналу/группе
  bot.on('chat_member', async (ctx: Context) => {
    try {
      const update = ctx.chatMember;
      if (!update) return;

      const botData = await prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!botData || !botData.isActive) {
        return;
      }

      const chat = update.chat;
      if (chat.type !== 'channel' && chat.type !== 'group' && chat.type !== 'supergroup') {
        return;
      }

      const user = update.new_chat_member.user;
      if (!user) return;

      const userId = user.id;
      const oldStatus = update.old_chat_member.status;
      const newStatus = update.new_chat_member.status;

      // Проверяем, что это присоединение (JOIN)
      const isJoin = oldStatus === 'left' && newStatus === 'member';

      // Проверяем, что канал принадлежит этому боту
      const channels = (botData.channels as Array<{ name: string; url: string }>) || [];
      const channelLink = botData.channelLink as string | null;
      if (channelLink && !channels.some((ch) => ch.url === channelLink)) {
        channels.push({ name: 'Канал', url: channelLink });
      }

      const channelUsername = chat.username;
      const channelId = chat.id.toString();

      // Проверяем, что это один из каналов бота
      let isBotChannel = false;
      for (const channel of channels) {
        const channelUrl = channel.url.toLowerCase();
        if (channelUsername) {
          const variants = [
            `@${channelUsername}`,
            `https://t.me/${channelUsername}`,
            `http://t.me/${channelUsername}`,
            `t.me/${channelUsername}`,
            channelUsername,
          ];
          if (variants.some((v) => channelUrl.includes(v.toLowerCase()))) {
            isBotChannel = true;
            break;
          }
        }
        if (channelUrl.includes(channelId) || channelUrl.includes(`-${channelId}`)) {
          isBotChannel = true;
          break;
        }
      }

      if (!isBotChannel) {
        return;
      }

      // Получаем или создаем пользователя
      let telegramUser = await prisma.telegramUser.findFirst({
        where: {
          botId,
          telegramUserId: BigInt(userId),
        },
      });

      if (!telegramUser) {
        telegramUser = await prisma.telegramUser.create({
          data: {
            botId,
            telegramUserId: BigInt(userId),
            username: user.username || null,
            firstName: user.first_name || null,
            lastName: user.last_name || null,
            source: null,
            status: 'active',
            joinedAt: new Date(),
            lastActivity: new Date(),
          },
        });
      } else {
        telegramUser = await prisma.telegramUser.update({
          where: { id: telegramUser.id },
          data: {
            username: user.username || null,
            firstName: user.first_name || null,
            lastName: user.last_name || null,
            lastActivity: new Date(),
            ...(telegramUser.status === 'blocked' ? { status: 'active' } : {}),
          },
        });
      }

      // Обрабатываем триггер присоединения к каналу
      if (isJoin) {
        await processTriggerEvent(TriggerEvent.USER_JOINED_CHANNEL, botId, userId, {
          channel_id: channelId,
          channel_username: channelUsername || null,
          channel_title: chat.title || null,
        });
      } else if (oldStatus === 'member' && newStatus === 'left') {
        // Обрабатываем триггер отписки от канала
        await processTriggerEvent(TriggerEvent.USER_LEFT_CHANNEL, botId, userId, {
          channel_id: channelId,
          channel_username: channelUsername || null,
          channel_title: chat.title || null,
        });
      }
    } catch (error) {
      console.error(`Error in handle_chat_member for bot ${botId}:`, error);
    }
  });
}
