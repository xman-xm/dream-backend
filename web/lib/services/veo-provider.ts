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
  private gatewayBaseUrl: string;

  constructor() {
    this.apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY || "";
    this.gatewayBaseUrl = process.env.AI_GATEWAY_URL || process.env.VERCEL_AI_GATEWAY_URL || "https://ai-gateway.vercel.sh";
    this.model = process.env.AI_GATEWAY_MODEL || process.env.VERCEL_AI_GATEWAY_MODEL || "bytedance/seedance-2.5";
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private extractVideoUrl(data: any): string | undefined {
    const candidates = [
      data?.video?.url,
      data?.video?.download_url,
      data?.video_url,
      data?.output?.[0]?.url,
      data?.output?.[0]?.video_url,
      data?.result?.[0]?.url,
      data?.result?.video_url,
      data?.data?.[0]?.url,
      data?.data?.[0]?.video_url,
      data?.url,
      data?.download_url,
      data?.result?.video?.url,
    ];

    return candidates.find((candidate): candidate is string => Boolean(candidate && typeof candidate === "string"));
  }

  async generate(params: VideoGenerationParams): Promise<VideoGenerationResult> {
    const preset = GoogleVeo31LiteProvider.preset;
    const rate = VEO_RATES[preset.resolution];
    const estimatedCostUSD = preset.durationSeconds * rate;

    if (!this.apiKey) {
      console.warn("[VeoProvider] AI Gateway API key is not configured. Running in backend simulation mode.");
      const mockOpId = `veo_op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        operationId: mockOpId,
        estimatedCostUSD,
        status: "GENERATING",
      };
    }

    try {
      const response = await fetch(`${this.gatewayBaseUrl}/v1/videos`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          prompt: params.prompt,
          size: params.resolution === "1080p" ? "1080x1920" : "720x1280",
          duration: params.durationSeconds || preset.durationSeconds,
          aspect_ratio: params.aspectRatio || preset.aspectRatio,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vercel AI Gateway video API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const operationId = data?.id || data?.video_id || `seedance_${Date.now()}`;
      const videoUrl = this.extractVideoUrl(data);

      if (videoUrl) {
        return {
          operationId,
          estimatedCostUSD,
          status: "COMPLETED",
          videoUrl,
        };
      }

      return {
        operationId,
        estimatedCostUSD,
        status: "GENERATING",
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initiate Vercel AI Gateway video generation";
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
      return {
        operationId,
        estimatedCostUSD: 0.4,
        status: "COMPLETED",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      };
    }

    try {
      const url = operationId.startsWith("http")
        ? operationId
        : `${this.gatewayBaseUrl}/v1/videos/${encodeURIComponent(operationId)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vercel AI Gateway status API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const normalizedStatus = String(data?.status || data?.state || "completed").toUpperCase();
      const videoUrl = this.extractVideoUrl(data);

      if (["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(normalizedStatus)) {
        if (!videoUrl) {
          return {
            operationId,
            estimatedCostUSD: 0,
            status: "FAILED",
            errorMessage: "Model finished without returning a video URL",
          };
        }

        return {
          operationId,
          estimatedCostUSD: 0,
          status: "COMPLETED",
          videoUrl,
        };
      }

      if (["FAILED", "ERROR", "CANCELLED"].includes(normalizedStatus)) {
        return {
          operationId,
          estimatedCostUSD: 0,
          status: "FAILED",
          errorMessage: data?.error?.message || "Video generation failed",
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
