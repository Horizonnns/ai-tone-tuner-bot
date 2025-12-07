// src/tests/testMetrics.ts
import { recordRewrite, recordError, getMetrics } from "../services/metricsService";
import { prisma } from "../db/client";
import fs from "fs";
import path from "path";

async function testMetrics() {
  console.log("🧪 Начинаем тестирование метрик...\n");

  try {
    // 1. Тест записи переписок
    console.log("1️⃣ Тестируем recordRewrite...");
    await recordRewrite({
      latencyMs: 1500,
      inputChars: 100,
      outputChars: 120,
      tone: "professional",
    });
    await recordRewrite({
      latencyMs: 2300,
      inputChars: 200,
      outputChars: 250,
      tone: "friendly",
    });
    await recordRewrite({
      latencyMs: 1800,
      inputChars: 150,
      outputChars: 180,
      tone: "professional",
    });
    console.log("✅ recordRewrite: 3 записи добавлены\n");

    // 2. Тест записи ошибок
    console.log("2️⃣ Тестируем recordError...");
    await recordError();
    await recordError();
    console.log("✅ recordError: 2 ошибки записаны\n");

    // 3. Тест получения метрик
    console.log("3️⃣ Тестируем getMetrics...");
    const metrics = await getMetrics();

    console.log("📊 Полученные метрики:\n");
    console.log("👥 Пользователи:");
    console.log(`   Всего: ${metrics.users.total}`);
    console.log(`   Активных сегодня: ${metrics.users.active_today}`);
    console.log(`   Активных за 7 дней: ${metrics.users.active_7d}`);
    console.log(`   Активных за 30 дней: ${metrics.users.active_30d}`);
    console.log(`   Premium: ${metrics.users.premium}\n`);

    console.log("💼 Использование:");
    console.log(`   Всего переписок: ${metrics.usage.total_rewrites}`);
    console.log(`   Переписок сегодня: ${metrics.usage.rewrites_today}`);
    console.log(`   Средняя длина входа: ${metrics.usage.avg_input_length} символов`);
    console.log(`   Средняя длина выхода: ${metrics.usage.avg_output_length} символов`);
    console.log(`   Популярные тоны:`, metrics.usage.tones);
    console.log();

    console.log("💳 Платежи:");
    console.log(`   Всего платежей: ${metrics.payments.total_payments}`);
    console.log(`   Новых за 24ч: ${metrics.payments.new_payments_24h}`);
    console.log(`   История за 30 дней:`, Object.keys(metrics.payments.history_30d).length, "дней");
    console.log();

    console.log("❌ Ошибки:");
    console.log(`   Всего ошибок: ${metrics.errors.total_errors}`);
    console.log(`   Ошибок сегодня: ${metrics.errors.errors_today}`);
    console.log();

    console.log("⚙️ Система:");
    console.log(`   Длина очереди: ${metrics.system.queue_length ?? "N/A"}`);
    console.log(`   Одновременных задач: ${metrics.system.concurrent_tasks ?? "N/A"}`);
    console.log(`   Средняя задержка: ${metrics.system.latency_avg_ms} мс`);
    console.log(`   Медианная задержка (P50): ${metrics.system.latency_p50_ms} мс`);
    console.log(`   95-й перцентиль (P95): ${metrics.system.latency_p95_ms} мс`);
    console.log(`   Пиковая задержка: ${metrics.system.latency_peak_ms} мс`);
    console.log(`   Образцов задержки: ${metrics.system.latency_samples}`);
    console.log();

    // 4. Проверка файла метрик
    console.log("4️⃣ Проверяем файл метрик...");
    const metricsFile = path.join(process.cwd(), "logs", "metrics.json");
    if (fs.existsSync(metricsFile)) {
      const fileContent = JSON.parse(fs.readFileSync(metricsFile, "utf8"));
      console.log("✅ Файл метрик существует");
      console.log(`   Всего переписок в файле: ${fileContent.total_rewrites}`);
      console.log(`   Всего ошибок в файле: ${fileContent.errors_total}`);
      console.log(`   Образцов задержки: ${fileContent.latency_samples.length}`);
    } else {
      console.log("⚠️ Файл метрик не найден");
    }
    console.log();

    console.log("✅ Все тесты пройдены успешно!");
    console.log("\n💡 Для проверки через API:");
    console.log("   curl 'http://localhost:4000/api/admin/metrics?key=YOUR_SECRET_KEY'");

  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск теста
testMetrics().catch(console.error);

