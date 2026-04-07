// ai.service.js — Groq (retry logic bilan)
const Groq = require("groq-sdk");

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

// Retry helper — 429 da kutadi
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const groqRequest = async (params, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await getGroq().chat.completions.create(params);
    } catch (err) {
      const status = err?.status || err?.error?.status;
      if (status === 429 && i < retries - 1) {
        const wait = (i + 1) * 5000; // 5s, 10s, 15s
        console.log(`⏳ Groq 429 - ${wait / 1000}s kutamiz...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
};

// ===== 5 TA TEST SAVOL =====
const generateTests = async (extractedText, title = "Mustaqil ish") => {
  const prompt = `Sen talabalar mustaqil ishini tekshiruvchi AI yordamchisan.

Quyidagi matn asosida 5 ta test savoli tuz:
"""
${extractedText.substring(0, 5000)}
"""

FAQAT JSON formatda javob ber, boshqa hech narsa yozma:
{"questions":[{"id":1,"question":"Savol matni?","options":{"A":"variant1","B":"variant2","C":"variant3","D":"variant4"},"correctAnswer":"A","explanation":"Izoh"},{"id":2,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"B","explanation":"Izoh"},{"id":3,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"C","explanation":"Izoh"},{"id":4,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"A","explanation":"Izoh"},{"id":5,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"D","explanation":"Izoh"}]}`;

  const completion = await groqRequest({
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content || "";

  // JSON ajratish
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI javob formati noto'g'ri");

  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); }
  catch { throw new Error("AI javobini parse qilishda xatolik"); }

  if (!parsed.questions || parsed.questions.length < 5)
    throw new Error("AI 5 ta savol yarata olmadi");

  // Validatsiya
  const valid = parsed.questions.slice(0, 5).every(q =>
    q.question && q.options?.A && q.options?.B &&
    q.options?.C && q.options?.D &&
    ["A", "B", "C", "D"].includes(q.correctAnswer)
  );
  if (!valid) throw new Error("AI savollar formati noto'g'ri");

  return parsed.questions.slice(0, 5);
};

// ===== JAVOBLARNI TEKSHIRISH =====
const gradeAnswers = async (questions, studentAnswers) => {
  let correctCount = 0;
  const results = [];

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

  const percentage = (correctCount / 5) * 100;
  const { grade, gradeNumber } = calculateGrade(correctCount);
  return { correctCount, percentage, grade, gradeNumber, results };
};

// ===== AI FEEDBACK =====
const generateFeedback = async (extractedText, correctCount, percentage, results) => {
  try {
    const wrong = results
      .filter(r => !r.isCorrect)
      .map(r => `- ${r.question}`)
      .join("\n");

    const completion = await groqRequest({
      model: "llama3-8b-8192",
      messages: [{
        role: "user",
        content: `Talaba ${correctCount}/5 to'g'ri javob berdi (${percentage.toFixed(0)}%). ${wrong ? "Xato savollar:\n" + wrong : "Barchasi to'g'ri!"} O'zbek tilida 2-3 gaplik rag'batlantiruvchi fikr yoz.`,
      }],
      max_tokens: 150,
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content?.trim() || "";
  } catch {
    return `${correctCount}/5 to'g'ri javob. Ball: ${percentage.toFixed(0)}%`;
  }
};

// ===== BAHO =====
const calculateGrade = (correctCount) => {
  if (correctCount === 5) return { grade: "EXCELLENT", gradeNumber: 5 };
  if (correctCount === 4) return { grade: "GOOD", gradeNumber: 4 };
  if (correctCount === 3) return { grade: "SATISFACTORY", gradeNumber: 3 };
  return { grade: "UNSATISFACTORY", gradeNumber: 2 };
};

module.exports = { generateTests, gradeAnswers, generateFeedback, calculateGrade };
