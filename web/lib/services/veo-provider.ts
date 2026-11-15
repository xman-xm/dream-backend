import {
  createGateway,
  experimental_getVideoStatus as getVideoStatus,
  experimental_startVideo as startVideo,
} from "ai";
import { IVideoProvider, VideoGenerationParams, VideoGenerationResult } from "./video-provider.interface";
import { VEO_RATES } from "./credit-ledger";

export class AIGatewayVideoProvider implements IVideoProvider {
  private static readonly preset = {
    durationSeconds: 8,
    resolution: "720p" as const,
    aspectRatio: "9:16",
  };

  private apiKey: string;
  private model: string;
  private gatewayBaseUrl: string;

  constructor() {
    this.apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY || "";
    this.gatewayBaseUrl = process.env.AI_GATEWAY_URL || process.env.VERCEL_AI_GATEWAY_URL || "https://ai-gateway.vercel.sh";
    this.model = process.env.AI_GATEWAY_MODEL || process.env.VERCEL_AI_GATEWAY_MODEL || "bytedance/seedance-2.5";
  }

  private getGateway() {
    const baseUrl = this.gatewayBaseUrl.replace(/\/+$/, "");
    return createGateway({
      apiKey: this.apiKey,
      baseURL: baseUrl.endsWith("/v4/ai") ? baseUrl : `${baseUrl}/v4/ai`,
    });
  }

  async generate(params: VideoGenerationParams): Promise<VideoGenerationResult> {
    const preset = AIGatewayVideoProvider.preset;
    const durationSeconds = params.durationSeconds || preset.durationSeconds;
    const resolution = params.resolution || preset.resolution;
    const estimatedCostUSD = durationSeconds * VEO_RATES[resolution];

    if (!this.apiKey) {
      return {
        operationId: "",
        estimatedCostUSD,
        status: "FAILED",
        errorMessage: "Vercel AI Gateway API key is not configured",
      };
    }

    try {
      const { operation } = await startVideo({
        model: this.getGateway().videoModel(this.model),
        prompt: params.prompt,
        duration: durationSeconds,
        resolution: resolution === "1080p" ? "1080x1920" : "720x1280",
        aspectRatio: (params.aspectRatio || preset.aspectRatio) as `${number}:${number}`,
        generateAudio: true,
      });
      return {
        operationId: JSON.stringify({ model: this.model, operation }),
        estimatedCostUSD,
        status: "GENERATING",
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start Vercel AI Gateway video generation";
      console.error("[AIGatewayVideoProvider] Generation initiation failed:", err);
      return {
        operationId: "",
        estimatedCostUSD,
        status: "FAILED",
        errorMessage,
      };
    }
  }

  async checkStatus(operationId: string): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      return {
        operationId,
        estimatedCostUSD: 0,
        status: "FAILED",
        errorMessage: "Vercel AI Gateway API key is not configured",
      };
    }

    try {
      const storedOperation = JSON.parse(operationId) as {
        model?: unknown;
        operation?: unknown;
      };
      if (typeof storedOperation.model !== "string" || storedOperation.operation === undefined) {
        throw new Error("Stored AI Gateway operation is invalid");
      }

      const result = await getVideoStatus(this.getGateway().videoModel(storedOperation.model), {
        operation: storedOperation.operation as Parameters<typeof getVideoStatus>[1]["operation"],
      });

      if (result.status === "completed") {
        const video = result.videos[0];
        if (!video) throw new Error("Video model completed without returning a video");
        if (video.type === "url") {
          return {
            operationId,
            estimatedCostUSD: 0,
            status: "COMPLETED",
            videoUrl: video.url,
            videoContentType: video.mediaType,
          };
        }
        if (video.type === "binary") {
          return {
            operationId,
            estimatedCostUSD: 0,
            status: "COMPLETED",
            videoData: video.data,
            videoContentType: video.mediaType,
          };
        }
        if (video.type === "base64") {
          return {
            operationId,
            estimatedCostUSD: 0,
            status: "COMPLETED",
            videoData: Buffer.from(video.data, "base64"),
            videoContentType: video.mediaType,
          };
        }
        return {
          operationId,
          estimatedCostUSD: 0,
          status: "FAILED",
          errorMessage: "AI Gateway did not provide downloadable video data",
        };
      }

      if (result.status === "error") {
        return {
          operationId,
          estimatedCostUSD: 0,
          status: "FAILED",
          errorMessage: result.error || "Video generation failed",
        };
      }

      return {
        operationId,
        estimatedCostUSD: 0,
        status: "GENERATING",
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Status check failed";
      console.error("[AIGatewayVideoProvider] Status check failed:", err);
      return {
        operationId,
        estimatedCostUSD: 0,
        status: "FAILED",
        errorMessage,
      };
    }
  }
}
