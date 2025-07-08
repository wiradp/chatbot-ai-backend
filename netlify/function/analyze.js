import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function extractJson(text) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match && match[1]) return match[1];
  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex)
    return text.substring(startIndex, endIndex + 1);
  return text;
}

export async function handler(event, context) {
  // --- CORS Headers ---
  const allowedOrigins = [
    "https://wiradp.github.io",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  ];
  const origin = event.headers.origin || "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin
      : "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let text;
  try {
    const body = JSON.parse(event.body);
    text = body.text;
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body." }),
    };
  }

  if (!text) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Text for analysis is required." }),
    };
  }

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
    let rawText = response.text();

    const cleanedText = extractJson(rawText);
    const sanitizedJsonString = cleanedText.replace(/\n|\r/g, "");
    let parsedJson = JSON.parse(sanitizedJsonString);

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(normalizedData),
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "AI response format error. Please try again later.",
        raw: error.raw || "No raw response available.",
      }),
    };
  }
}
