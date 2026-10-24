export interface VideoGenerationParams {
  prompt: string;
  durationSeconds: number;
  resolution: "720p" | "1080p";
  aspectRatio: string;
}

export interface VideoGenerationResult {
  operationId: string;
  estimatedCostUSD: number;
  status: "QUEUED" | "GENERATING" | "COMPLETED" | "FAILED";
  videoUrl?: string;
  errorMessage?: string;
}

export interface IVideoProvider {
  /**
   * Submits a generation request to the provider model (Google Veo 3.1 Lite)
   */
  generate(params: VideoGenerationParams): Promise<VideoGenerationResult>;

  /**
   * Polls or queries status of an in-flight operation ID
   */
  checkStatus(operationId: string): Promise<VideoGenerationResult>;
}
