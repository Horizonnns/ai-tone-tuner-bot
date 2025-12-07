# 🧪 Тестирование метрик

Этот документ описывает способы проверки работоспособности системы метрик.

## 📋 Способы проверки

### 1. Автоматический тест (рекомендуется)

Запустите тестовый скрипт, который проверит все функции метрик:

```bash
npm run test:metrics
```

Скрипт:
- ✅ Запишет несколько тестовых переписок
- ✅ Запишет тестовые ошибки
- ✅ Получит и выведет все метрики
- ✅ Проверит файл метрик

### 2. Проверка через API эндпоинт

После запуска сервера (`npm run dev` или `npm start`), проверьте метрики через API:

```bash
# Замените YOUR_SECRET_KEY на значение из переменной окружения ADMIN_METRICS_KEY
curl 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY' | jq
```

Или откройте в браузере:
```
http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY
```

**Пример ответа:**
```json
{
  "users": {
    "total": 150,
    "active_today": 25,
    "active_7d": 80,
    "active_30d": 120,
    "premium": 15
  },
  "usage": {
    "total_rewrites": 1250,
    "rewrites_today": 45,
    "avg_input_length": 120,
    "avg_output_length": 150,
    "tones": {
      "professional": 500,
      "friendly": 400,
      "casual": 350
    }
  },
  "payments": {
    "total_payments": 20,
    "new_payments_24h": 2,
    "history_30d": {
      "2024-01-15": {
        "count": 1,
        "totalAmount": 199
      }
    }
  },
  "errors": {
    "total_errors": 15,
    "errors_today": 2
  },
  "system": {
    "queue_length": 3,
    "concurrent_tasks": 2,
    "latency_avg_ms": 1850,
    "latency_p50_ms": 1700,
    "latency_p95_ms": 3200,
    "latency_peak_ms": 4500,
    "latency_samples": 250
  }
}
```

### 3. Проверка файла метрик

Метрики сохраняются в файл `logs/metrics.json`. Вы можете проверить его напрямую:

```bash
cat logs/metrics.json | jq
```

Или вручную:
```bash
cat logs/metrics.json
```

### 4. Проверка в реальном времени

1. **Запустите сервер:**
   ```bash
   npm run dev
   ```

2. **Отправьте тестовый запрос на переписывание:**
   ```bash
   curl -X POST http://localhost:4000/api/rewrite \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Тестовый текст для переписывания",
       "tone": "professional",
       "telegramId": "123456789"
     }'
   ```

3. **Проверьте метрики:**
   ```bash
   curl 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY' | jq '.usage'
   ```

4. **Проверьте файл метрик:**
   ```bash
   cat logs/metrics.json | jq '.total_rewrites'
   ```

### 5. Проверка записи ошибок

Для проверки записи ошибок можно:

1. **Вызвать невалидный запрос:**
   ```bash
   curl -X POST http://localhost:4000/api/rewrite \
     -H "Content-Type: application/json" \
     -d '{"invalid": "data"}'
   ```

2. **Проверить метрики ошибок:**
   ```bash
   curl 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY' | jq '.errors'
   ```

## 🔍 Что проверять

### ✅ Основные метрики

- [ ] **Пользователи**: `users.total`, `users.active_today`, `users.active_7d`, `users.active_30d`, `users.premium`
- [ ] **Использование**: `usage.total_rewrites`, `usage.rewrites_today`, `usage.avg_input_length`, `usage.avg_output_length`, `usage.tones`
- [ ] **Платежи**: `payments.total_payments`, `payments.new_payments_24h`, `payments.history_30d`
- [ ] **Ошибки**: `errors.total_errors`, `errors.errors_today`
- [ ] **Система**: `system.queue_length`, `system.concurrent_tasks`, `system.latency_avg_ms`, `system.latency_p50_ms`, `system.latency_p95_ms`, `system.latency_peak_ms`

### ✅ Функции записи

- [ ] `recordRewrite()` - записывает метрики переписок
- [ ] `recordError()` - записывает метрики ошибок
- [ ] `getMetrics()` - возвращает все метрики

### ✅ Файл метрик

- [ ] Файл `logs/metrics.json` создается автоматически
- [ ] Данные сохраняются корректно
- [ ] Структура данных соответствует ожидаемой

## 🐛 Отладка

Если метрики не работают:

1. **Проверьте переменные окружения:**
   ```bash
   echo $ADMIN_METRICS_KEY
   ```

2. **Проверьте права на запись:**
   ```bash
   ls -la logs/
   ```

3. **Проверьте логи:**
   ```bash
   tail -f logs/bot.log
   ```

4. **Проверьте подключение к БД:**
   ```bash
   npm run prisma:studio
   ```

## 📝 Примеры использования

### Получить только метрики пользователей:
```bash
curl 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY' | jq '.users'
```

### Получить только метрики системы:
```bash
curl 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY' | jq '.system'
```

### Мониторинг в реальном времени:
```bash
watch -n 5 "curl -s 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY' | jq '.usage.rewrites_today, .system.queue_length, .system.concurrent_tasks'"
```

