import { GoogleGenAI } from "@google/genai";

async function testModel(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in .env.local");
    return;
  }
  console.log(`Testing model: ${modelName}...`);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: "Hello, tell me a 1-sentence joke about baseball."
    });
    console.log(`[Success] ${modelName}: ${response.text?.trim()}`);
  } catch (err) {
    console.error(`[Fail] ${modelName}:`, (err as Error).message);
  }
}

async function main() {
  const models = [
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-002",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
  ];
  for (const m of models) {
    await testModel(m);
    console.log("-----------------------------------");
  }
}

main();
