/**
 * Отдельный процесс для фоновых воркеров BullMQ.
 *
 * Зачем:
 * - чтобы тяжёлые задачи (рассылки, планировщик) не влияли на latency API (в т.ч. /auth/login)
 */

import './workers/broadcastWorker';

// Минимальный сигнал, что воркер-процесс поднялся
console.log('🧵 GateGram workers started');

