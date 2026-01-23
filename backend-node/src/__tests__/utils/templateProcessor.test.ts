/**
 * Тесты для templateProcessor
 */

import { processTemplate } from '../../utils/templateProcessor';

describe('Template Processor', () => {
  const mockUser = {
    telegramUserId: BigInt(123456789),
    firstName: 'Иван',
    lastName: 'Петров',
    username: 'ivan_petrov',
    source: 'telegram',
    status: 'active',
  };

  it('должен заменить переменные пользователя', () => {
    const template = 'Привет, {{user_name}}! Твой ID: {{user_id}}';
    const result = processTemplate(template, mockUser);

    expect(result).toBe('Привет, Иван! Твой ID: 123456789');
  });

  it('должен заменить все переменные', () => {
    const template = `
      Имя: {{user_first_name}}
      Фамилия: {{user_last_name}}
      Username: {{user_username}}
      Источник: {{source}}
      Статус: {{status}}
    `;
    const result = processTemplate(template, mockUser);

    expect(result).toContain('Иван');
    expect(result).toContain('Петров');
    expect(result).toContain('ivan_petrov');
    expect(result).toContain('telegram');
    expect(result).toContain('active');
  });

  it('должен обработать дополнительные данные', () => {
    const template = 'Привет, {{user_name}}! Канал: {{channel_name}}';
    const result = processTemplate(template, mockUser, {
      channel_name: 'Мой канал',
    });

    expect(result).toBe('Привет, Иван! Канал: Мой канал');
  });

  it('должен обработать пустой шаблон', () => {
    const result = processTemplate('', mockUser);
    expect(result).toBe('');
  });

  it('должен обработать шаблон без переменных', () => {
    const template = 'Просто текст без переменных';
    const result = processTemplate(template, mockUser);
    expect(result).toBe(template);
  });

  it('должен обработать переменные с пробелами', () => {
    const template = 'Привет, {{ user_name }}!';
    const result = processTemplate(template, mockUser);
    expect(result).toBe('Привет, Иван!');
  });

  it('должен использовать username если нет first_name', () => {
    const userWithoutName = {
      ...mockUser,
      firstName: null,
      username: 'testuser',
    };
    const template = 'Привет, {{user_name}}!';
    const result = processTemplate(template, userWithoutName);
    expect(result).toBe('Привет, testuser!');
  });

  it('должен использовать "Пользователь" если нет ни имени ни username', () => {
    const userWithoutName = {
      ...mockUser,
      firstName: null,
      username: null,
    };
    const template = 'Привет, {{user_name}}!';
    const result = processTemplate(template, userWithoutName);
    expect(result).toBe('Привет, Пользователь!');
  });
});
