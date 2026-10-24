import { IVideoProvider, VideoGenerationParams, VideoGenerationResult } from "./video-provider.interface";
import { VEO_RATES } from "./credit-ledger";

export class GoogleVeo31LiteProvider implements IVideoProvider {
  private static readonly preset = {
    durationSeconds: 8,
    resolution: "720p" as const,
    aspectRatio: "9:16",
  };
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_VEO_API_KEY || "";
    this.model = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-lite-generate-preview";
  }

  async generate(params: VideoGenerationParams): Promise<VideoGenerationResult> {
    const preset = GoogleVeo31LiteProvider.preset;
    const rate = VEO_RATES[preset.resolution];
    const estimatedCostUSD = preset.durationSeconds * rate;

    // Fallback/Simulated operational mock if API key is not yet configured in local development environment
    if (!this.apiKey) {
      console.warn("[VeoProvider] GOOGLE_VEO_API_KEY is not configured in .env. Running in backend simulation mode.");
      const mockOpId = `veo_op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        operationId: mockOpId,
        estimatedCostUSD,
        status: "GENERATING",
      };
    }

    try {
      // Veo uses the Gemini API long-running prediction endpoint.
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predictLongRunning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            instances: [{ prompt: params.prompt }],
            parameters: {
              aspectRatio: preset.aspectRatio,
              durationSeconds: preset.durationSeconds,
              resolution: preset.resolution,
              sampleCount: 1,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Veo API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return {
        operationId: data.name || data.operationId || `veo_${Date.now()}`,
        estimatedCostUSD,
        status: "GENERATING",
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initiate Veo video generation";
      console.error("[VeoProvider] Generation initiation failed:", err);
      return {
        operationId: "",
        estimatedCostUSD,
        status: "FAILED",
        errorMessage,
      };
    }
  }

  async checkStatus(operationId: string): Promise<VideoGenerationResult> {
    if (!this.apiKey || operationId.startsWith("veo_op_")) {
      // Simulation mode: pretend job completes after short delay
      return {
        operationId,
        estimatedCostUSD: 0.40,
        status: "COMPLETED",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      };
    }

    try {
      const operationPath = operationId.startsWith("http")
        ? operationId
        : `https://generativelanguage.googleapis.com/v1beta/${operationId}`;
      const response = await fetch(operationPath, {
        headers: {
          "x-goog-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Veo status API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (data.done) {
        if (data.error) {
          return {
            operationId,
            estimatedCostUSD: 0,
            status: "FAILED",
            errorMessage: data.error.message || "Veo job failed",
          };
        }

        const generatedVideo =
          data.response?.generateVideoResponse?.generatedSamples?.[0]?.video ||
          data.response?.generatedVideos?.[0]?.video ||
          data.response?.video;
        const videoUrl = generatedVideo?.uri || generatedVideo?.url;
        if (!videoUrl) {
          return {
            operationId,
            estimatedCostUSD: 0,
            status: "FAILED",
            errorMessage: "Veo completed without returning a video URL",
          };
        }

        return {
          operationId,
          estimatedCostUSD: 0,
          status: "COMPLETED",
          videoUrl,
        };
      }

      return {
        operationId,
        estimatedCostUSD: 0,
        status: "GENERATING",
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Status check failed";
      return {
        operationId,
        estimatedCostUSD: 0,
        status: "FAILED",
        errorMessage,
      };
    }
  }
}
