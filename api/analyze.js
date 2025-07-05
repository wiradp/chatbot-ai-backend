import { GoogleGenerativeAI } from "@google/generative-ai";

// Inisialisasi Gemini dengan API Key dari Environment Variables Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // REKOMENDASI: Gunakan model 1.5 Flash yang lebih baru dan lebih baik dalam mengikuti instruksi JSON.

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
    res.status(204).end();
    return;
  }
  // --- END: Penambahan Header CORS ---

  // --- START: Langkah Debugging ---
  // Log ini untuk memastikan server Vercel lokal berhasil memuat API Key.
  console.log(
    "API Key Loaded by Server:",
    process.env.GEMINI_API_KEY
      ? "Yes, key is present."
      : "No, key is UNDEFINED or empty."
  );
  // --- END: Langkah Debugging ---

  // Hanya izinkan metode POST untuk analisis
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text for analysis is required." });
  }

  // PROMPT YANG DIPERBAIKI: Lebih tegas dan tidak ambigu untuk memastikan format JSON yang benar.
  const prompt = `Analyze the following text. Your response MUST be a single, valid JSON object and nothing else. Do not use markdown formatting like \`\`\`json.
The JSON object must have these exact English keys: "category", "confidence", "sentiment", "explanation", "risk_indicators", "language".
The values for "explanation" and "risk_indicators" should be in the same language as the input text.
The value for "category" must be one of: "Scam", "Online Gambling", "Hoax", "Safe".
The value for "confidence" must be one of: "LOW", "MEDIUM", "HIGH".
The value for "sentiment" must be one of: "Positive", "Negative", "Neutral".
The value for "language" must be the detected language name in English.

Text to analyze:
\`\`\`
${text}
\`\`\`
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    // Log respons mentah dari AI untuk debugging
    console.log("Raw response from Gemini:", rawText);

    // 1. Ekstrak JSON dari markdown jika ada (sebagai fallback)
    const cleanedText = extractJson(rawText);

    // 2. Sanitasi string untuk menghapus newline yang bisa merusak parser
    const sanitizedJsonString = cleanedText.replace(/\n|\r/g, "");
    const parsedJson = JSON.parse(sanitizedJsonString);

    // 3. Normalisasi data untuk memastikan kunci selalu dalam bahasa Inggris,
    //    meskipun AI salah memberikan kunci dalam bahasa Indonesia.
    const normalizedData = {
      category: parsedJson.category || parsedJson.kategori || "Unknown",
      confidence: parsedJson.confidence || "N/A",
      sentiment: parsedJson.sentiment || "N/A",
      explanation:
        parsedJson.explanation ||
        parsedJson.penjelasan ||
        "No explanation provided.",
      risk_indicators:
        parsedJson.risk_indicators || parsedJson.indikator_bahaya || [],
      language: parsedJson.language || "Unknown",
    };

    res.status(200).json(normalizedData);
  } catch (error) {
    // Log error lengkap di sisi server untuk debugging
    console.error("Error calling Gemini API or parsing response:", error);
    res
      .status(500)
      // Berikan pesan error yang lebih spesifik
      .json({
        error: "AI response format error. Please try again later.",
        raw: rawText || "No raw response available.",
      });
  }
}
