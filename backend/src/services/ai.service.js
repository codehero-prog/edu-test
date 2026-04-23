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

// JSON ni xavfsiz parse qilish — LaTeX \\ belgilarini to'g'irlaydi
const safeJsonParse = (text) => {
  // 1. To'g'ridan parse qilishga harakat
  try {
    return JSON.parse(text);
  } catch {}

  // 2. LaTeX \\ ni vaqtincha almashtirish
  try {
    const fixed = text
      .replace(/\\(?!["\\/bfnrtu])/g, "\\\\") // yakka \ ni \\ ga
      .replace(/[\x00-\x1F\x7F]/g, " "); // control chars
    return JSON.parse(fixed);
  } catch {}

  // 3. Qo'lda tozalash
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

// ===== TEST SAVOLLAR YARATISH =====
const generateTests = async (
  extractedText,
  title = "Mustaqil ish",
  options = {},
) => {
  const questionCount = options.questionCount || 5;
  const customPrompt = options.customPrompt || null;
  const isMath = isMathContent(extractedText + " " + title);

  // LaTeX uchun muhim: AI ga JSON ichida LaTeX yozishni o'rgatish
  const latexNote = isMath
    ? `
IMPORTANT - LaTeX in JSON:
- Use LaTeX for ALL math: inline \\(formula\\) or $formula$
- In JSON strings, backslash must be doubled: \\\\frac, \\\\sqrt, \\\\times
- Example question: "Solve: $x^2 - 5x + 6 = 0$"
- Example option: "$x = 2$ and $x = 3$"`
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
    taskInstruction = `Teacher instruction: ${customPrompt}\nCreate exactly ${resolvedCount} questions.${latexNote}`;
  } else {
    taskInstruction = `Create exactly ${resolvedCount} test questions based on the text.${latexNote}`;
  }

  const prompt = `You are an AI that creates multiple choice test questions for students.

Text to base questions on:
"""
${extractedText.substring(0, 5000)}
"""

${taskInstruction}

Respond ONLY with valid JSON, no markdown, no extra text:
${buildJsonExample(resolvedCount)}`;

  const completion = await groqRequest({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: Math.max(2000, resolvedCount * 400),
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content || "";

  // JSON ni topish
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
    const wrong = results
      .filter((r) => !r.isCorrect)
      .map((r) => `- ${r.question}`)
      .join("\n");

    const completion = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Talaba ${correctCount}/${total} to'g'ri javob berdi (${percentage.toFixed(0)}%). ${wrong ? "Xato savollar:\n" + wrong : "Barchasi to'g'ri!"} O'zbek tilida 2-3 gaplik rag'batlantiruvchi fikr yoz.`,
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
