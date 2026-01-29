import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function generateImageDescription(fileBuffer: Buffer, mimeType: string = "image/jpeg"): Promise<string | null> {
    if (!genAI) {
        console.warn("Gemini API Key is missing. Skipping AI description.");
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = "Analyze this image for a search engine. The image is in a 9:16 vertical portrait format. Provide a detailed, single-paragraph description including objects, colors, context, and mood. Also include a list of relevant keywords.";

        const imagePart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;

        console.log(`[Gemini] Finish Reason: ${response.candidates?.[0]?.finishReason}`);
        console.log(`[Gemini] Safety Ratings: ${JSON.stringify(response.candidates?.[0]?.safetyRatings)}`);

        const text = response.text();
        return text;
    } catch (error) {
        console.error("Error generating AI description:", error);
        return null;
    }
}

export async function getEmbedding(text: string): Promise<number[] | null> {
    if (!genAI || !text.trim()) {
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);

        if (result && result.embedding && result.embedding.values) {
            return result.embedding.values;
        }
        return null;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
}
