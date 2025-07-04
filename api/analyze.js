import { GoogleGenerativeAI } from "@google/generative-ai";

// Inisialisasi Gemini dengan API Key dari Environment Variables Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Helper function untuk mengekstrak JSON dari string yang mungkin dibungkus markdown
function extractJson(text) {
  // Mencari blok JSON di dalam markdown ```json ... ```
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    return match[1];
  }
  // Fallback jika tidak ada markdown, cari dari '{' pertama hingga '}' terakhir
  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return text.substring(startIndex, endIndex + 1);
  }
  return text; // Kembalikan teks asli jika tidak ada struktur JSON yang ditemukan
}

// Handler utama untuk Vercel Serverless Function
export default async function handler(req, res) {
  // --- START: Langkah Debugging ---
  // Log ini untuk memastikan server Vercel lokal berhasil memuat API Key.
  console.log(
    "API Key Loaded by Server:",
    process.env.GEMINI_API_KEY
      ? "Yes, key is present."
      : "No, key is UNDEFINED or empty."
  );
  // --- END: Langkah Debugging ---

  // --- START: Penambahan Header CORS ---
  // Daftar origin yang diizinkan untuk mengakses API ini
  const allowedOrigins = [
    "http://127.0.0.1:5500", // Alamat default Live Server
    "http://localhost:5500", // Alamat lain yang mungkin dari Live Server
    "https://wiradp.github.io", // Alamat portofolio produksi Anda
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Browser akan mengirim request 'OPTIONS' (preflight) sebelum 'POST'
  // untuk mengecek izin CORS. Kita harus menanganinya.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  // --- END: Penambahan Header CORS ---

  // Hanya izinkan metode POST untuk analisis
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text for analysis is required." });
  }

  // Revisi prompt agar AI membalas dengan bahasa yang sama dengan input
  const prompt = `You are an expert AI for detecting scams, hoaxes, online gambling promotions.
Analyze the text below and classify it into one of: "Scam", "Online Gambling", "Hoax", "Safe".
Return a strict JSON object with this structure: {"category": "...", "confidence": "<LOW|MEDIUM|HIGH>", "sentiment": "<Positive|Negative|Neutral>", "explanation": "...", "risk_indicators": [...], "language": "<detected language name in English, e.g. 'English', 'Indonesian', etc.>"}.
Do not include any other text or markdown formatting like \`\`\`json. Just the raw JSON object.
IMPORTANT: Your explanation and all output must use the same language as the input text. If the input is in Indonesian, answer in Indonesian. If the input is in English, answer in English. If the input is in another language, answer in that language.
Text to analyze: ${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    // Log respons mentah dari AI untuk debugging
    console.log("Raw response from Gemini:", rawText);

    // Bersihkan dan parse JSON
    const cleanedText = extractJson(rawText);
    const parsedJson = JSON.parse(cleanedText);

    res.status(200).json(parsedJson);
  } catch (error) {
    // Log error lengkap di sisi server untuk debugging
    console.error("Error calling Gemini API or parsing response:", error);
    res
      .status(500)
      .json({ error: "Failed to get a valid response from the AI model." });
  }
}
