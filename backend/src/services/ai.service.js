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

const buildJsonExample = (count) => {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    question: `Savol ${i + 1}?`,
    options: { A: "variant1", B: "variant2", C: "variant3", D: "variant4" },
    correctAnswer: ["A", "B", "C", "D"][i % 4],
    explanation: "Izoh",
  }));
  return JSON.stringify({ questions: items });
};

// Matematik mavzu aniqlash — o'zbek, rus, ingliz tillari
const isMathContent = (text) => {
  const mathKeywords =
    /математик|алгебр|геометр|интеграл|дифференциал|уравнени|формул|вычислени|теорем|функци|предел|вероятност|статистик|matematik|algebra|geometr|integral|differensial|tengla|formula|hisob|funksiya|limit|calculus|equation|theorem|derivative|matrix|vector|trigon/i;
  // Matematik belgilar ham tekshiramiz
  const mathSymbols =
    /[=+\-×÷√∑∏∫∂²³]|(\d+[\+\-\*\/]\d+)|(x\^?\d)|(sin|cos|tan|log|ln)\s*\(/i;
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

  const latexRule = isMath
    ? `
LATEX QOIDASI (MAJBURIY):
- Barcha matematik formulalar, tenglamalar, sonlar LaTeX formatida yozilishi SHART.
- Inline formula: $formula$ (masalan: $x^2 + 2x - 3 = 0$, $\\frac{a}{b}$, $\\sqrt{x}$)
- Blok formula: $$formula$$ (masalan: $$\\int_0^1 x^2 dx = \\frac{1}{3}$$)
- Savol matni ichida ham, variantlarda ham LaTeX ishlat.
- Misol savol: "Quyidagi tenglamaning ildizini toping: $x^2 - 5x + 6 = 0$"
- Misol variant: "A: $x = 2, x = 3$"
- LATEX ISHLATMASANG NOTO'G'RI HISOBLANADI.`
    : "";

  let taskInstruction;
  let resolvedCount = questionCount;

  if (customPrompt) {
    const countMatch = customPrompt.match(
      /(\d+)\s*ta\s*(test|savol)|(\d+)\s*вопрос/i,
    );
    const promptCount = countMatch
      ? parseInt(countMatch[1] || countMatch[3])
      : null;
    resolvedCount = promptCount || questionCount;

    taskInstruction = `O'qituvchi ko'rsatmasi: ${customPrompt}

Jami ${resolvedCount} ta test savoli tuz. Ko'rsatmaga qat'iy amal qil.
${latexRule}`;
  } else {
    taskInstruction = `${resolvedCount} ta test savoli tuz.
${latexRule}`;
  }

  const prompt = `Sen talabalar mustaqil ishini tekshiruvchi AI yordamchisan.

Quyidagi matn asosida test savollar tuz:
"""
${extractedText.substring(0, 6000)}
"""

${taskInstruction}

FAQAT JSON formatda javob ber, boshqa hech narsa yozma:
${buildJsonExample(resolvedCount)}`;

  const completion = await groqRequest({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: Math.max(2000, resolvedCount * 400),
    temperature: 0.2,
  });

  const text = completion.choices[0]?.message?.content || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI javob formati noto'g'ri");

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("AI javobini parse qilishda xatolik");
  }

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
