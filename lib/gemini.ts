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

        const prompt = "Analyze this image or video to generate a list of 5-10 relevant high-intent keywords.Do not use general keywords, make keywords precise for the post.The search engine prioterizes precision over post number.";

        const imagePart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;

        console.log(`[Gemini] Finish Reason: ${response.candidates?.[0]?.finishReason}`);

        const text = response.text();
        return text;
    } catch (error) {
        console.error("Error generating AI description:", error);
        return null;
    }
}

export async function analyzeVideo(fileBuffer: Buffer, mimeType: string = "video/mp4"): Promise<string | null> {
    if (!genAI) {
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = "Analyze this video for a search engine. Describe the visual content (actions, setting, people), the audio context (what is being said, background sounds), and the overall mood. Provide a comprehensive summary and keywords.";

        // Note: Inline video storage has size limits (usually ~20MB for Generative AI).
        // For larger files, use the File API (uploadFile) pattern.
        // For this MVP, we assume Short/Compressed videos or just checking first chunk.
        const videoPart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType
            },
        };

        const result = await model.generateContent([prompt, videoPart]);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error analyzing video:", error);
        return null;
    }
}

export async function getEmbedding(text: string): Promise<number[] | null> {
    if (!genAI || !text.trim()) {
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" }, { apiVersion: 'v1beta' });
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
