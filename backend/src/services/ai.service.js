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
const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {}
  try {
    const fixed = text
      .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
      .replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(fixed);
  } catch {}
  try {
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {}
  return null;
};

const buildJsonExample = (count) => {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    question: `Вопрос ${i + 1}?`,
    options: { A: "вариант1", B: "вариант2", C: "вариант3", D: "вариант4" },
    correctAnswer: ["A", "B", "C", "D"][i % 4],
    explanation: "Объяснение",
  }));
  return JSON.stringify({ questions: items }, null, 2);
};

// Matematik mavzu aniqlash
const isMathContent = (text) => {
  const mathKeywords =
    /математик|алгебр|геометр|интеграл|дифференциал|уравнени|формул|теорем|функци|предел|вероятност|статистик|matematik|algebra|geometr|integral|differensial|tengla|formula|funksiya|limit|calculus|equation|theorem|derivative|matrix|vector|trigon/i;
  const mathSymbols =
    /[=√∑∏∫∂]|(\d+[\+\-\*\/]\d+)|(x\^?\d)|(sin|cos|tan|log|ln)\s*\(/i;
  return mathKeywords.test(text) || mathSymbols.test(text);
};

// Til aniqlash
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

  if (ruOnlyChars > 2 || ruWords > 3 || (cyrillic > 80 && ruWords >= uzWords))
    return "ru";
  if (uzWords > 3 || /o'|g'|sh|ch/i.test(sample)) return "uz";
  if (cyrillic > 50) return "ru";
  return "en";
};

// System prompt tili bo'yicha
const getSystemPrompt = (lang, isMath) => {
  const langMap = {
    ru: "Ты создаёшь тестовые вопросы. Пиши ВСЕ вопросы и варианты ответов ТОЛЬКО на русском языке.",
    uz: "Siz test savollari yaratasiz. BARCHA savollar va variantlarni FAQAT o'zbek tilida yozing.",
    en: "You create test questions. Write ALL questions and options in English only.",
  };

  const latexRule = isMath
    ? lang === "ru"
      ? " Все математические формулы записывай в LaTeX: $формула$ (в JSON используй двойной обратный слеш: \\\\frac, \\\\sqrt)."
      : lang === "uz"
        ? " Barcha matematik formulalarni LaTeX da yozing: $formula$ (JSON da ikki backslash: \\\\frac, \\\\sqrt)."
        : " Use LaTeX for all math: $formula$ (double backslash in JSON: \\\\frac, \\\\sqrt)."
    : "";

  return (langMap[lang] || langMap.en) + latexRule;
};

// ===== TEST SAVOLLAR YARATISH =====
const generateTests = async (extractedText, title = "", options = {}) => {
  const questionCount = options.questionCount || 5;
  const customPrompt = options.customPrompt || null;
  const isMath = isMathContent(extractedText + " " + title);
  const lang = detectLanguage(extractedText);

  console.log(`📝 Til: ${lang} | Matematik: ${isMath}`);

  const systemPrompt = getSystemPrompt(lang, isMath);

  let resolvedCount = questionCount;
  let userMsg;

  if (customPrompt) {
    const countMatch = customPrompt.match(
      /(\d+)\s*ta\s*(test|savol)|(\d+)\s*вопрос/i,
    );
    resolvedCount = countMatch
      ? parseInt(countMatch[1] || countMatch[3])
      : questionCount;

    userMsg =
      lang === "ru"
        ? `Инструкция преподавателя: ${customPrompt}\n\nСоздай ровно ${resolvedCount} вопроса по тексту:\n"""\n${extractedText.substring(0, 5000)}\n"""\n\nВерни ТОЛЬКО JSON без markdown:\n${buildJsonExample(resolvedCount)}`
        : `Teacher: ${customPrompt}\n\nCreate ${resolvedCount} questions from:\n"""\n${extractedText.substring(0, 5000)}\n"""\n\nReturn ONLY JSON:\n${buildJsonExample(resolvedCount)}`;
  } else {
    userMsg =
      lang === "ru"
        ? `Создай ${resolvedCount} тестовых вопроса по следующему тексту:\n"""\n${extractedText.substring(0, 5000)}\n"""\n\nВерни ТОЛЬКО JSON без markdown:\n${buildJsonExample(resolvedCount)}`
        : lang === "uz"
          ? `Quyidagi matn asosida ${resolvedCount} ta test savoli tuz:\n"""\n${extractedText.substring(0, 5000)}\n"""\n\nFAQAT JSON qaytargin:\n${buildJsonExample(resolvedCount)}`
          : `Create ${resolvedCount} test questions from:\n"""\n${extractedText.substring(0, 5000)}\n"""\n\nReturn ONLY JSON:\n${buildJsonExample(resolvedCount)}`;
  }

  const completion = await groqRequest({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
    max_tokens: Math.max(2000, resolvedCount * 400),
    temperature: 0.1,
  });

  const raw = completion.choices[0]?.message?.content || "";
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

    const systemMap = {
      ru: "Ты помощник преподавателя. Пиши ТОЛЬКО на русском языке.",
      uz: "Siz o'qituvchi yordamchisiz. FAQAT o'zbek tilida yozing.",
      en: "You are a teacher's assistant. Write in English only.",
    };

    const userMap = {
      ru: `Студент ответил правильно на ${correctCount}/${total} (${percentage.toFixed(0)}%). ${wrong ? "Неверные:\n" + wrong : "Все правильно!"} Напиши 2-3 ободряющих предложения.`,
      uz: `Talaba ${correctCount}/${total} to'g'ri javob berdi (${percentage.toFixed(0)}%). ${wrong ? "Xato:\n" + wrong : "Hammasi to'g'ri!"} 2-3 gap rag'batlantiruvchi fikr yoz.`,
      en: `Student got ${correctCount}/${total} (${percentage.toFixed(0)}%). ${wrong ? "Wrong:\n" + wrong : "All correct!"} Write 2-3 encouraging sentences.`,
    };

    const completion = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemMap[lang] || systemMap.en },
        { role: "user", content: userMap[lang] || userMap.en },
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
