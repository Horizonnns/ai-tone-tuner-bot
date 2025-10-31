import { Telegraf } from "telegraf";
import { prisma } from "../db/client";
import { log } from "../utils/logger";

// export function setupPremium(bot: Telegraf) {
//   bot.command("premium", async (ctx) => {
//     const userId = ctx.from.id.toString();
//     const user = await prisma.user.findUnique({ where: { telegramId: userId } });

//     if (user?.isPremium) {
//       await ctx.reply("💎 У тебя уже активен Premium! Наслаждайся безлимитом 🚀");
//       return;
//     }

//     // На MVP — просто активируем премиум “вручную”
//     await prisma.user.update({
//       where: { telegramId: userId },
//       data: { isPremium: true },
//     });

//     log(`User ${userId} получил премиум`);
//     await ctx.reply("✨ Premium активирован! Теперь лимитов нет 😉");
//   });
// }
