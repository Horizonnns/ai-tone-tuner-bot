export type TLang = "ru" | "tj" | "uz" | "kz";

export const i18n: Record<TLang, any> = {
  ru: {
    choose_language: "Выберите язык",
    greeting: (name: string) =>
      `Привет, ${name}\\! 👋\nЯ *AI Tone Tuner* — твой редактор настроения\\. 💫\nНапиши текст, выбери стиль — и я сделаю его звучным\\!\nНапример: \n _\`\Нужен React-разработчик\`\_`,

    share: "Поделиться",
    invite: "Поделись ссылкой и получи +2 попытки!",

    tones: {
      header: "Выбери стиль, в котором переписать:",
      list: {
        business: "💼 Деловой",
        friendly: "💬 Дружелюбный",
        hype: "🚀 Хайповый",
        inspire: "✨ Вдохновляющий",
        persuasive: "🧠 Убедительный",
        humorous: "😄 С юмором",
        custom: "✏️ Свой стиль",
        more: "➕ Ещё стили",
        less: "⬅️ Меньше",
      },
    },

    result: {
      prefix: (toneName: string) => `Вот твой текст в стиле *${toneName}*:`,
      attempts: (used: number, total: number) =>
        `\n\n_${used}/${total} попыток на сегодня_`,
    },

    premium: {
      offer: (premiumUrl: string) => {
        const base =
          "✨ Открой безлимитные переписывания\n\n" +
          "💎 Оформи *AI Tone Tuner Premium* на 30 дней и пиши без ограничений\n\n";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nСсылка для оплаты: ${premiumUrl}`
            : "")
        );
      },
      alreadyHas: (until?: string) =>
        until
          ? `💎 У тебя уже есть Premium ✨\nАктивен до: ${until}`
          : "💎 У тебя уже есть Premium✨",
      button: "💳 Купить Premium — 199₽",
      success:
        "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
    },

    limit: {
      reached: (premiumUrl: string) => {
        const base =
          "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪\n\n" +
          "💎 Хочешь без ограничений? Подключи Premium ✨";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nСсылка для оплаты: ${premiumUrl}`
            : "")
        );
      },
    },

    referral: {
      friendJoined: (friendName: string) =>
        `🎉 Твой друг ${friendName} присоединился по твоей ссылке!\nТы получил +2 попытки на сегодня 💪`,
    },

    errors: {
      somethingWentWrong: "⚠️ Что-то пошло не так. Попробуй позже!",
      sendTextFirst: "Отправь текст сначала 🙂",
      sendTextThenStyle: "Сначала отправь текст, затем выбери стиль 🙂",
      customTonePrompt:
        "Напиши стиль/тон, в котором переписать (пример: 'лаконичный официальный')",
    },
  },

  tj: {
    choose_language: "Забонро интихоб кунед",
    greeting: (name: string) =>
      `Салом, ${name}\\! 👋\nМан *AI Tone Tuner* ҳастам — таҳриргари рӯҳияи матни ту\\. 💫\nМатнро навис, услубро интихоб кун — ман онро равшантар мекунам\\!\nМисол: \n _\`\React-барномасоз лозим аст\`\_`,

    share: "Мубодила",
    invite: "Пайвандро ба дӯстон фирист ва +2 кӯшиш гир!",

    tones: {
      header: "Услубро интихоб кунед:",
      list: {
        business: "💼 Расмӣ",
        friendly: "💬 Дӯстона",
        hype: "🚀 Хайпдор",
        inspire: "✨ Илҳомбахш",
        persuasive: "🧠 Қаноатбахш",
        humorous: "😄 Баҳзадор",
        custom: "✏️ Услуби худ",
        more: "➕ Бештар",
        less: "⬅️ Камтар",
      },
    },

    result: {
      prefix: (toneName: string) => `Матни ту дар услуби *${toneName}*:`,
      attempts: (used: number, total: number) =>
        `\n\n_${used}/${total} кӯшиш барои имрӯз_`,
    },

    premium: {
      offer: (premiumUrl: string) => {
        const base =
          "✨ Кушодани навиштани беҳадд\n\n" +
          "💎 *AI Tone Tuner Premium* барои 30 рӯз гир ва бе маҳдудият навис\n\n";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nПайванди пардохт: ${premiumUrl}`
            : "")
        );
      },
      alreadyHas: (until?: string) =>
        until
          ? `💎 Ту аллакай Premium дори ✨\nФаъол то: ${until}`
          : "💎 Ту аллакай Premium дори✨",
      button: "💳 Харидани Premium — 199₽",
      success:
        "🎉 Пардохт бомуваффақият анҷом ёфт!\n💎 *AI Tone Tuner Premium* барои 30 рӯз фаъол шуд",
    },

    limit: {
      reached: (premiumUrl: string) => {
        const base =
          "🔥 Ту аз нақшаи ройгон ҳама чизро истифода бурдӣ. Фардо — энергияи нав! 💪\n\n" +
          "💎 Без маҳдудият мехоҳӣ? Premium-ро фаъол кун ✨";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nПайванди пардохт: ${premiumUrl}`
            : "")
        );
      },
    },

    referral: {
      friendJoined: (friendName: string) =>
        `🎉 Дӯсти ту ${friendName} бо пайванди ту пайваст шуд!\nТу +2 кӯшиш барои имрӯз гирифтӣ 💪`,
    },

    errors: {
      somethingWentWrong: "⚠️ Чизе нодуруст шуд. Баъдтар кӯшиш кун!",
      sendTextFirst: "Аввал матн фирист 🙂",
      sendTextThenStyle: "Аввал матн фирист, баъд услубро интихоб кун 🙂",
      customTonePrompt:
        "Услуб/тонро навис, ки дар он қайд карда шавад (масалан: 'мухтасар расмӣ')",
    },
  },

  uz: {
    choose_language: "Tilni tanlang",
    greeting: (name: string) =>
      `Salom, ${name}\\! 👋\nMen *AI Tone Tuner* — matn kayfiyatini o'zgartirib beruvchi yordamchingiz\\. 💫\nMatn yozing, uslubni tanlang — men uni yanada chiroyli qilib beraman\\!\nMasalan: \n _\`\React dasturchisi kerak\`\_`,

    share: "Ulashish",
    invite: "Do‘stlarga ulashing va har biri uchun +2 urinish oling!",

    tones: {
      header: "Qaysi uslubda qayta yozay?",
      list: {
        business: "💼 Rasmiy",
        friendly: "💬 Do'stona",
        hype: "🚀 Hype uslubi",
        inspire: "✨ Ilhomlantiruvchi",
        persuasive: "🧠 Ishontiruvchi",
        humorous: "😄 Hazil aralash",
        custom: "✏️ O'zingizning uslubingiz",
        more: "➕ Ko'proq",
        less: "⬅️ Kamroq",
      },
    },

    result: {
      prefix: (toneName: string) => `Mana sizning matningiz *${toneName}* uslubida:`,
      attempts: (used: number, total: number) => `\n\n_${used}/${total} urinish bugun_`,
    },

    premium: {
      offer: (premiumUrl: string) => {
        const base =
          "✨ Cheksiz qayta yozishni oching\n\n" +
          "💎 *AI Tone Tuner Premium* 30 kun uchun rasmiylashtiring va cheklovlarsiz yozing\n\n";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nTo'lov havolasi: ${premiumUrl}`
            : "")
        );
      },
      alreadyHas: (until?: string) =>
        until
          ? `💎 Sizda allaqachon Premium bor ✨\nFaol: ${until}`
          : "💎 Sizda allaqachon Premium bor✨",
      button: "💳 Premium sotib olish — 199₽",
      success:
        "🎉 To'lov muvaffaqiyatli amalga oshirildi!\n💎 *AI Tone Tuner Premium* 30 kun uchun faollashtirildi",
    },

    limit: {
      reached: (premiumUrl: string) => {
        const base =
          "🔥 Siz bepul rejadan maksimal foydalandingiz. Ertaga — yangi energiya! 💪\n\n" +
          "💎 Cheklovlarsiz xohlayapsizmi? Premium-ni ulang ✨";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nTo'lov havolasi: ${premiumUrl}`
            : "")
        );
      },
    },

    referral: {
      friendJoined: (friendName: string) =>
        `🎉 Do'stingiz ${friendName} sizning havolangiz orqali qo'shildi!\nSiz bugun +2 urinish oldingiz 💪`,
    },

    errors: {
      somethingWentWrong: "⚠️ Nimadir noto'g'ri ketdi. Keyinroq urinib ko'ring!",
      sendTextFirst: "Avval matn yuboring 🙂",
      sendTextThenStyle: "Avval matn yuboring, keyin uslubni tanlang 🙂",
      customTonePrompt: "Qayta yozish uslubi/tonini yozing (masalan: 'qisqa rasmiy')",
    },
  },

  kz: {
    choose_language: "Тілді таңдаңыз",
    greeting: (name: string) =>
      `Сәлем, ${name}\\! 👋\nМен *AI Tone Tuner* — мәтіннің көңіл\\-күйін түзететін көмекшің\\. 💫\nМәтінді жаз, стильді таңда — мен оны әсерлі етіп беремін\\!\nМысалы: \n _\`\React әзірлеушісі қажет\`\_`,

    share: "Бөлісу",
    invite: "Достарыңызбен бөлісіп, әрқайсысы үшін +2 мүмкіндік алыңыз!",

    tones: {
      header: "Қай стильде қайта жазайын?",
      list: {
        business: "💼 Ресми",
        friendly: "💬 Достық",
        hype: "🚀 Хайп стилі",
        inspire: "✨ Шабыттандыратын",
        persuasive: "🧠 Сендіргіш",
        humorous: "😄 Әзілмен",
        custom: "✏️ Өз стиліңіз",
        more: "➕ Тағы",
        less: "⬅️ Азайту",
      },
    },

    result: {
      prefix: (toneName: string) => `Міне сіздің мәтініңіз *${toneName}* стилінде:`,
      attempts: (used: number, total: number) => `\n\n_${used}/${total} мүмкіндік бүгін_`,
    },

    premium: {
      offer: (premiumUrl: string) => {
        const base =
          "✨ Шексіз қайта жазуды ашыңыз\n\n" +
          "💎 *AI Tone Tuner Premium* 30 күнге рәсімдеңіз және шектеусіз жазыңыз\n\n";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nТөлем сілтемесі: ${premiumUrl}`
            : "")
        );
      },
      alreadyHas: (until?: string) =>
        until
          ? `💎 Сізде қазірдің өзінде Premium бар ✨\nБелсенді: ${until}`
          : "💎 Сізде қазірдің өзінде Premium бар✨",
      button: "💳 Premium сатып алу — 199₽",
      success:
        "🎉 Төлем сәтті аяқталды!\n💎 *AI Tone Tuner Premium* 30 күнге белсендірілді",
    },

    limit: {
      reached: (premiumUrl: string) => {
        const base =
          "🔥 Сіз тегін жоспардан максимумды пайдаландыңыз. Ертең — жаңа энергия! 💪\n\n" +
          "💎 Шектеусіз қалайсыз ба? Premium-ды қосыңыз ✨";
        return (
          base +
          (premiumUrl.includes("localhost") || premiumUrl.includes("127.0.0.1")
            ? `\nТөлем сілтемесі: ${premiumUrl}`
            : "")
        );
      },
    },

    referral: {
      friendJoined: (friendName: string) =>
        `🎉 Досыңыз ${friendName} сіздің сілтемеңіз арқылы қосылды!\nСіз бүгін +2 мүмкіндік алдыңыз 💪`,
    },

    errors: {
      somethingWentWrong: "⚠️ Бірдеңе дұрыс болмады. Кейінірек қайталап көріңіз!",
      sendTextFirst: "Алдымен мәтін жіберіңіз 🙂",
      sendTextThenStyle: "Алдымен мәтін жіберіңіз, содан кейін стильді таңдаңыз 🙂",
      customTonePrompt: "Қайта жазу стилін/тонын жазыңыз (мысалы: 'қысқа ресми')",
    },
  },
};

// Память для выбора языка
export const userLang = new Map<string, TLang>();
