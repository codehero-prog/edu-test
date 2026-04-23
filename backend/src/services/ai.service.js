const Groq = require("groq-sdk");

let _groq = null;
const getGroq = () => {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const groqRequest = async (params, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await getGroq().chat.completions.create(params);
    } catch (err) {
      const status = err?.status || err?.error?.status;
      if (status === 429 && i < retries - 1) {
        const wait = (i + 1) * 5000;
        console.log(`⏳ Groq 429 - ${wait / 1000}s kutamiz...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
};

// JSON ni xavfsiz parse qilish
const safeJsonParse = (raw) => {
  const attempts = [
    // 1. To'g'ridan
    () => JSON.parse(raw),
    // 2. Markdown tozalash
    () =>
      JSON.parse(
        raw
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim(),
      ),
    // 3. Control chars tozalash
    () => JSON.parse(raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")),
    // 4. LaTeX backslash fix
    () => {
      const fixed = raw.replace(/"((?:[^"\\]|\\.)*)"/g, (match, content) => {
        return '"' + content.replace(/\\(?!["\\/bfnrtu])/g, "\\\\") + '"';
      });
      return JSON.parse(fixed);
    },
    // 5. Kesilgan JSON ni yopish
    () => {
      let text = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
      // Oxirgi to'liq savol gacha kesish
      const lastComplete = text.lastIndexOf("}");
      if (lastComplete === -1) throw new Error("No closing brace");
      text = text.substring(0, lastComplete + 1);
      // questions array ni yopish
      if (!text.includes('"questions"')) throw new Error("No questions key");
      // To'liq JSON tuzish
      const openBraces = (text.match(/\{/g) || []).length;
      const closeBraces = (text.match(/\}/g) || []).length;
      const openBracks = (text.match(/\[/g) || []).length;
      const closeBracks = (text.match(/\]/g) || []).length;
      text += "]".repeat(Math.max(0, openBracks - closeBracks));
      text += "}".repeat(Math.max(0, openBraces - closeBraces));
      return JSON.parse(text);
    },
  ];

  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {}
  }

  console.error("❌ Parse failed. Raw:", raw.substring(0, 300));
  return null;
};

// Qisqa JSON example — kamroq token sarflash uchun
const buildJsonExample = (count) => {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    question: "Q?",
    options: { A: "a", B: "b", C: "c", D: "d" },
    correctAnswer: "A",
    explanation: "exp",
  }));
  return JSON.stringify({ questions: items });
};

const isMathContent = (text) => {
  const mathKw =
    /математик|алгебр|геометр|интеграл|дифференциал|уравнени|формул|теорем|функци|предел|вероятност|статистик|matematik|algebra|geometr|integral|differensial|tengla|formula|funksiya|limit|calculus|equation|theorem|derivative|matrix|vector|trigon|multivariable|partial/i;
  const mathSym =
    /[=√∑∏∫∂]|(\d+[\+\-\*\/]\d+)|(x\^?\d)|(sin|cos|tan|log|ln)\s*\(/i;
  return mathKw.test(text) || mathSym.test(text);
};

const detectLanguage = (text) => {
  const sample = text.substring(0, 2000);
  const ruOnlyChars = (sample.match(/[ыэъё]/gi) || []).length;
  const ruWords = (
    sample.match(
      /\b(и|в|на|что|это|как|для|или|но|не|по|из|к|с|о|от|до|при|под|над|за|со|без|об|про|через|между)\b/gi,
    ) || []
  ).length;
  const uzWords = (
    sample.match(
      /\b(va|bu|bir|bilan|uchun|ham|lekin|agar|yoki|kerak|bo'ladi|qiladi|deb|ning|ga|dan|da|ni)\b/gi,
    ) || []
  ).length;
  const cyrillic = (sample.match(/[а-яёА-ЯЁ]/g) || []).length;
  const latin = (sample.match(/[a-zA-Z]/g) || []).length;

  if (ruOnlyChars > 2 || ruWords > 3 || (cyrillic > 80 && ruWords >= uzWords))
    return "ru";
  if (uzWords > 3 || /o'|g'|sh|ch/i.test(sample)) return "uz";
  if (cyrillic > 50) return "ru";
  if (latin > 100) return "en";
  return "en";
};

const getSystemPrompt = (lang, isMath) => {
  const base =
    {
      ru: "Ты создаёшь тестовые вопросы. Отвечай ТОЛЬКО на русском языке. Возвращай ТОЛЬКО валидный JSON без пояснений.",
      uz: "Siz test savollari yaratasiz. FAQAT o'zbek tilida javob bering. FAQAT JSON qaytaring.",
      en: "You create test questions. Reply in English only. Return ONLY valid JSON, no explanations.",
    }[lang] || "You create test questions. Return ONLY valid JSON.";

  const mathRule = isMath
    ? {
        ru: " Для формул используй LaTeX: $формула$. В JSON строках пиши \\\\frac, \\\\sqrt (двойной слеш).",
        uz: " Formulalar uchun LaTeX ishlat: $formula$. JSON da \\\\frac, \\\\sqrt (ikki backslash).",
        en: " Use LaTeX for math: $formula$. In JSON write \\\\frac, \\\\sqrt (double backslash).",
      }[lang] || ""
    : "";

  return base + mathRule;
};

// ===== TEST SAVOLLAR YARATISH =====
const generateTests = async (extractedText, title = "", options = {}) => {
  const questionCount = options.questionCount || 5;
  const customPrompt = options.customPrompt || null;
  const isMath = isMathContent(extractedText + " " + title);
  const lang = detectLanguage(extractedText);

  console.log(
    `📝 Til: ${lang} | Matematik: ${isMath} | Savol: ${questionCount}`,
  );

  let resolvedCount = questionCount;
  if (customPrompt) {
    const countMatch = customPrompt.match(
      /(\d+)\s*ta\s*(test|savol)|(\d+)\s*вопрос/i,
    );
    resolvedCount = countMatch
      ? parseInt(countMatch[1] || countMatch[3])
      : questionCount;
  }

  // Matnni qisqartirish — ko'p token sarflamaslik uchun
  const shortText = extractedText.substring(0, 3000);

  const userMsg =
    {
      ru: `Создай ${resolvedCount} вопросов по тексту. Верни ТОЛЬКО JSON.\nТекст: """${shortText}"""\nФормат: ${buildJsonExample(resolvedCount)}`,
      uz: `${resolvedCount} ta savol tuz. FAQAT JSON qaytar.\nMatn: """${shortText}"""\nFormat: ${buildJsonExample(resolvedCount)}`,
      en: `Create ${resolvedCount} questions. Return ONLY JSON.\nText: """${shortText}"""\nFormat: ${buildJsonExample(resolvedCount)}`,
    }[lang] ||
    `Create ${resolvedCount} questions. Return ONLY JSON.\nText: """${shortText}"""\nFormat: ${buildJsonExample(resolvedCount)}`;

  // max_tokens: har bir savol ~300 token, minimum 3000
  const maxTokens = Math.max(3000, resolvedCount * 500);

  const completion = await groqRequest({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: getSystemPrompt(lang, isMath) },
      { role: "user", content: userMsg },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  });

  const raw = completion.choices[0]?.message?.content || "";
  console.log(`🤖 AI raw (${raw.length} chars):`, raw.substring(0, 200));

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI javob formati noto'g'ri");

  const parsed = safeJsonParse(jsonMatch[0]);
  if (!parsed) throw new Error("AI javobini parse qilishda xatolik");

  if (!parsed.questions || parsed.questions.length < 1)
    throw new Error("AI savollar yarata olmadi");

  const valid = parsed.questions.every(
    (q) =>
      q.question &&
      q.options?.A &&
      q.options?.B &&
      q.options?.C &&
      q.options?.D &&
      ["A", "B", "C", "D"].includes(q.correctAnswer),
  );
  if (!valid) throw new Error("AI savollar formati noto'g'ri");

  return parsed.questions.slice(0, resolvedCount);
};

// ===== JAVOBLARNI TEKSHIRISH =====
const gradeAnswers = async (questions, studentAnswers) => {
  let correctCount = 0;
  const results = [];
  const total = questions.length;

  questions.forEach((q, i) => {
    const studentAnswer = studentAnswers[i]?.selectedAnswer || null;
    const isCorrect = studentAnswer === q.correctAnswer;
    if (isCorrect) correctCount++;
    results.push({
      questionId: q.id || i + 1,
      question: q.question,
      studentAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation || "",
    });
  });

  const percentage = (correctCount / total) * 100;
  const { grade, gradeNumber } = calculateGrade(correctCount, total);
  return { correctCount, total, percentage, grade, gradeNumber, results };
};

// ===== AI FEEDBACK =====
const generateFeedback = async (
  extractedText,
  correctCount,
  percentage,
  results,
) => {
  try {
    const total = results.length;
    const lang = detectLanguage(extractedText);
    const wrong = results
      .filter((r) => !r.isCorrect)
      .map((r) => `- ${r.question}`)
      .join("\n");

    const sysMap = {
      ru: "Ты помощник преподавателя. Пиши ТОЛЬКО на русском.",
      uz: "Siz o'qituvchi yordamchisiz. FAQAT o'zbek tilida yozing.",
      en: "You are a teacher assistant. Write in English only.",
    };
    const usrMap = {
      ru: `Студент: ${correctCount}/${total} (${percentage.toFixed(0)}%). ${wrong ? "Неверные:\n" + wrong : "Всё правильно!"} 2-3 ободряющих предложения.`,
      uz: `Talaba: ${correctCount}/${total} (${percentage.toFixed(0)}%). ${wrong ? "Xato:\n" + wrong : "Hammasi to'g'ri!"} 2-3 gap rag'batlantiruvchi fikr.`,
      en: `Student: ${correctCount}/${total} (${percentage.toFixed(0)}%). ${wrong ? "Wrong:\n" + wrong : "All correct!"} 2-3 encouraging sentences.`,
    };

    const completion = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: sysMap[lang] || sysMap.en },
        { role: "user", content: usrMap[lang] || usrMap.en },
      ],
      max_tokens: 200,
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content?.trim() || "";
  } catch {
    return `${correctCount}/${results.length} to'g'ri javob. Ball: ${percentage.toFixed(0)}%`;
  }
};

// ===== BAHO =====
const calculateGrade = (correctCount, total = 5) => {
  const pct = (correctCount / total) * 100;
  if (pct >= 90) return { grade: "EXCELLENT", gradeNumber: 5 };
  if (pct >= 70) return { grade: "GOOD", gradeNumber: 4 };
  if (pct >= 50) return { grade: "SATISFACTORY", gradeNumber: 3 };
  return { grade: "UNSATISFACTORY", gradeNumber: 2 };
};

module.exports = {
  generateTests,
  gradeAnswers,
  generateFeedback,
  calculateGrade,
};
