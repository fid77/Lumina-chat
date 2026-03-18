import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiResponse = async (prompt: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  if (!apiKey) {
    throw new Error("La clé API Gemini n'est pas configurée.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "Tu es Lumina, un assistant intelligent, amical et serviable. Réponds de manière concise et engageante en français.",
    },
    history: history,
  });

  const response: GenerateContentResponse = await chat.sendMessage({ message: prompt });
  return response.text;
};
