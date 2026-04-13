// ai.service.js — Groq (retry logic bilan)
const Groq = require("groq-sdk");

let _groq = null;
const getGroq = () => {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const groqRequest = async (params, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await getGroq().chat.completions.create(params);
    } catch (err) {
      const status = err?.status || err?.error?.status;
      if (status === 429 && i < retries - 1) {
        const wait = (i + 1) * 5000;
        console.log(`⏳ Groq 429 - ${wait/1000}s kutamiz...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
};

// ===== 5 TA TEST SAVOL + 2 TA MASALA (matematika uchun) =====
const generateTests = async (extractedText, title = "Mustaqil ish") => {
  const isMath = /matematik|algebra|geometr|integral|differensial|tengla|formula|hisob|son|to'plam|funksiya|limit|trigonometr|vektor|matritsa|kombinatorika|ehtimollik|statistika|logarifm|daraja/i.test(extractedText + title);

  const mathPrompt = `Sen o'zbek tilida dars beradigan matematik o'qituvchisan. Talabaning quyidagi mustaqil ishi matnini o'qib, uning mavzuni qay darajada tushunganligini aniqlaydigan 5 ta test savoli va 2 ta amaliy masala tuz.

MATN:
"""
${extractedText.substring(0, 5000)}
"""

QOIDALAR:
1. Birinchi 3 ta savol (id: 1,2,3) — NAZARIY savollar bo'lsin:
   - Ta'rif, qonun, xususiyat, teorema haqida
   - "Qaysi ta'rif to'g'ri?", "Bu formula nima uchun ishlatiladi?" kabi
2. Keyingi 2 ta savol (id: 4,5) — HISOB-KITOB savollari bo'lsin:
   - Aniq raqamlar bilan hisoblash kerak bo'lsin
   - Masalan: $\\frac{d}{dx}(x^3)$ = ?, yoki $\\int_0^1 x^2 dx$ = ?
3. BARCHA matematik ifodalar LaTeX formatida yozilsin:
   - Inline: $formula$ (masalan: $x^2 + 1$)
   - Blok: $$formula$$ (masalan: $$\\frac{a^2-b^2}{a+b} = a-b$$)
   - To'g'ri LaTeX: \\frac{a}{b}, \\sqrt{x}, \\int, \\sum, \\lim, x^{2}, x_{n}
4. Variantlar ham LaTeX bilan yozilsin: "$2x+1$", "$$\\sqrt{3}$$"
5. Savollar talabaning mavzuni TUSHUNGANLIGINI tekshirsin, oddiy yodlashni emas

2 ta AMALIY MASALA (problems):
- To'liq yechim ko'rsatilsin, har bir qadam LaTeX bilan
- Mavzuga mos misol/masala bo'lsin
- Yechim bosqichlari: "1-qadam: ...", "2-qadam: ..." ko'rinishida

FAQAT JSON formatda javob ber, boshqa hech narsa yozma:
{"questions":[{"id":1,"type":"theory","question":"Nazariy savol?","options":{"A":"$variant$","B":"variant","C":"variant","D":"variant"},"correctAnswer":"A","explanation":"Izoh"},{"id":2,"type":"theory","question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"B","explanation":"Izoh"},{"id":3,"type":"theory","question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"C","explanation":"Izoh"},{"id":4,"type":"calculation","question":"$..$ = ?","options":{"A":"$...$","B":"$...$","C":"$...$","D":"$...$"},"correctAnswer":"A","explanation":"Izoh"},{"id":5,"type":"calculation","question":"Hisoblang: $...$","options":{"A":"$...$","B":"$...$","C":"$...$","D":"$...$"},"correctAnswer":"D","explanation":"Izoh"}],"problems":[{"id":1,"problem":"Masala matni $LaTeX$","solution":"1-qadam: ...\\n2-qadam: ...","answer":"$javob$"},{"id":2,"problem":"Masala matni","solution":"Yechim","answer":"$javob$"}]}`;

  const generalPrompt = `Sen talabalar mustaqil ishini tekshiruvchi AI yordamchisan.

Quyidagi matn asosida talabaning mavzuni qay darajada tushunganligini aniqlaydigan 5 ta test savoli tuz:
"""
${extractedText.substring(0, 5000)}
"""

QOIDALAR:
1. Savollar talabaning TUSHUNISHINI tekshirsin (oddiy yodlash emas)
2. Savollar qiyinlik darajasi bo'yicha: 2 ta oson, 2 ta o'rta, 1 ta qiyin
3. O'zbek tilida yoz
4. Har bir javob varianti aniq va qisqa bo'lsin
5. Izohlar (explanation) talabaga nima noto'g'ri ekanini tushuntirsin

FAQAT JSON formatda javob ber:
{"questions":[{"id":1,"question":"Savol matni?","options":{"A":"variant1","B":"variant2","C":"variant3","D":"variant4"},"correctAnswer":"A","explanation":"Izoh"},{"id":2,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"B","explanation":"Izoh"},{"id":3,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"C","explanation":"Izoh"},{"id":4,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"A","explanation":"Izoh"},{"id":5,"question":"Savol?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"D","explanation":"Izoh"}]}`;

  const completion = await groqRequest({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: isMath ? mathPrompt : generalPrompt }],
    max_tokens: 3000,
    temperature: 0.2,
  });

  const text = completion.choices[0]?.message?.content || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI javob formati noto'g'ri");

  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); }
  catch { throw new Error("AI javobini parse qilishda xatolik"); }

  if (!parsed.questions || parsed.questions.length < 5)
    throw new Error("AI 5 ta savol yarata olmadi");

  const valid = parsed.questions.slice(0, 5).every(q =>
    q.question && q.options?.A && q.options?.B &&
    q.options?.C && q.options?.D &&
    ["A","B","C","D"].includes(q.correctAnswer)
  );
  if (!valid) throw new Error("AI savollar formati noto'g'ri");

  return {
    questions: parsed.questions.slice(0, 5),
    problems: parsed.problems || [],
    isMath,
  };
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
      questionId:    q.id || i + 1,
      question:      q.question,
      studentAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation:   q.explanation || "",
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
      model: "llama-3.3-70b-versatile",
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
  if (correctCount === 5) return { grade: "EXCELLENT",      gradeNumber: 5 };
  if (correctCount === 4) return { grade: "GOOD",           gradeNumber: 4 };
  if (correctCount === 3) return { grade: "SATISFACTORY",   gradeNumber: 3 };
  return                         { grade: "UNSATISFACTORY", gradeNumber: 2 };
};

module.exports = { generateTests, gradeAnswers, generateFeedback, calculateGrade };