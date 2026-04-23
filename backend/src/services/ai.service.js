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
    question: `Question ${i + 1}?`,
    options: { A: "option1", B: "option2", C: "option3", D: "option4" },
    correctAnswer: ["A", "B", "C", "D"][i % 4],
    explanation: "Explanation",
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

// Til aniqlash — aniqroq algoritm
const detectLanguage = (text) => {
  const sample = text.substring(0, 2000);

  // Rus tiliga XOS harflar (o'zbek kirilida yo'q): ы, э, ъ, ё
  const ruOnlyChars = (sample.match(/[ыэъё]/gi) || []).length;

  // Rus tiliga xos so'zlar
  const ruWords = (
    sample.match(
      /\b(и|в|на|что|это|как|для|или|но|да|нет|не|по|из|к|с|о|от|до|при|под|над|за|со|без|об|про|через|между|против)\b/gi,
    ) || []
  ).length;

  // O'zbek tiliga xos so'zlar
  const uzWords = (
    sample.match(
      /\b(va|bu|bir|bilan|uchun|ham|lekin|agar|yoki|kerak|bo'ladi|qiladi|deb|degan|ning|ga|dan|da|ni)\b/gi,
    ) || []
  ).length;

  // Kirill harflar umumiy soni
  const cyrillic = (sample.match(/[а-яёА-ЯЁ]/g) || []).length;

  // Agar rus tiliga xos belgilar ko'p bo'lsa yoki rus so'zlari ko'p
  if (ruOnlyChars > 3 || ruWords > 5 || (cyrillic > 100 && ruWords > uzWords)) {
    return "Russian";
  }

  // O'zbek (lotin yoki kirill)
  if (uzWords > 3 || /o'|g'|sh|ch|ng/i.test(sample)) {
    return "Uzbek";
  }

  // Kirill bor lekin aniqlab bo'lmadi — russian deb hisobla
  if (cyrillic > 50) return "Russian";

  return "English";
};

// ===== TEST SAVOLLAR YARATISH =====
const generateTests = async (
  extractedText,
  title = "Mustaqil ish",
  options = {},
) => {
  const questionCount = options.questionCount || 5;
  const customPrompt = options.customPrompt || null;
  const isMath = isMathContent(extractedText + " " + title);

  // Til aniqlash
  const lang = detectLanguage(extractedText);
  console.log(`📝 Til aniqlandi: ${lang}`);

  const langInstruction = `CRITICAL: Write ALL questions, ALL answer options, and ALL explanations ONLY in ${lang} language. Do NOT use any other language.`;

  const latexNote = isMath
    ? `
LaTeX RULES (MANDATORY for math):
- Use LaTeX for ALL math formulas: inline $formula$
- In JSON strings backslash must be doubled: \\\\frac, \\\\sqrt, \\\\times
- Example: "$x^2 + 2x - 3 = 0$", "$\\\\frac{a}{b}$"`
    : "";

  let resolvedCount = questionCount;
  let taskInstruction;

  if (customPrompt) {
    const countMatch = customPrompt.match(
      /(\d+)\s*ta\s*(test|savol)|(\d+)\s*вопрос/i,
    );
    const promptCount = countMatch
      ? parseInt(countMatch[1] || countMatch[3])
      : null;
    resolvedCount = promptCount || questionCount;
    taskInstruction = `Teacher instruction: ${customPrompt}\nCreate exactly ${resolvedCount} questions.\n${langInstruction}${latexNote}`;
  } else {
    taskInstruction = `Create exactly ${resolvedCount} test questions.\n${langInstruction}${latexNote}`;
  }

  const prompt = `You are an AI assistant creating multiple choice test questions.

Source text:
"""
${extractedText.substring(0, 5000)}
"""

${taskInstruction}

Output ONLY valid JSON, no markdown:
${buildJsonExample(resolvedCount)}`;

  const completion = await groqRequest({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: Math.max(2000, resolvedCount * 400),
    temperature: 0.2,
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

    const completion = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Student answered ${correctCount}/${total} correctly (${percentage.toFixed(0)}%). ${wrong ? "Wrong:\n" + wrong : "All correct!"} Write 2-3 encouraging sentences in ${lang}.`,
        },
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
