"use client";

import React, { useState, useEffect } from "react";

export default function StudioClient() {
  // Form State
  const [prompt, setPrompt] = useState<string>("");
  const [drafts, setDrafts] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedDrafts = JSON.parse(localStorage.getItem("veo-drafts") || "[]");
      return Array.isArray(savedDrafts)
        ? savedDrafts.filter((draft): draft is string => typeof draft === "string")
        : [];
    } catch {
      return [];
    }
  });

  // Job Status State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cost Estimation
  const duration = 8;
  const resolution = "720p";
  const aspectRatio = "9:16";

  const saveDraft = () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    const nextDrafts = [trimmedPrompt, ...drafts.filter((draft) => draft !== trimmedPrompt)].slice(0, 8);
    setDrafts(nextDrafts);
    localStorage.setItem("veo-drafts", JSON.stringify(nextDrafts));
  };

  const deleteDraft = (draft: string) => {
    const nextDrafts = drafts.filter((item) => item !== draft);
    setDrafts(nextDrafts);
    localStorage.setItem("veo-drafts", JSON.stringify(nextDrafts));
  };

  // Poll Job Status
  useEffect(() => {
    if (!activeJobId || !isGenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/status/${activeJobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setJobStatus(data.status);

        if (data.status === "COMPLETED") {
          setIsGenerating(false);
          setGeneratedVideoUrl(data.videoAsset?.storageUrl || null);
          clearInterval(interval);
        } else if (data.status === "FAILED") {
          setIsGenerating(false);
          setErrorMessage(data.errorMessage || "Generation failed");
          clearInterval(interval);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobId, isGenerating]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setErrorMessage(null);
    setGeneratedVideoUrl(null);
    setIsGenerating(true);
    setJobStatus("QUEUED");

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          durationSeconds: duration,
          resolution,
          aspectRatio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsGenerating(false);
        setErrorMessage(data.error || "Failed to submit job");
        return;
      }

      setActiveJobId(data.jobId);
      setJobStatus(data.status);
    } catch (err: unknown) {
      setIsGenerating(false);
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate video");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0b0f19", color: "#f3f4f6", fontFamily: "Inter, sans-serif" }}>
      {/* Navigation Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2rem", borderBottom: "1px solid #1f293d", backgroundColor: "#111827" }}>
        {/* Right Column: Video Preview & Status Screen */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.2rem" }}>
            V
          </div>
          <span style={{ fontSize: "1.25rem", fontWeight: "700", letterSpacing: "-0.025em" }}>VeoStudio 3.1</span>
        </div>
      </header>

      {/* Main Studio Container */}
      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        
        {/* Left Column: Prompt & Generation Controls */}
        <div style={{ backgroundColor: "#111827", borderRadius: "16px", padding: "1.5rem", border: "1px solid #1f293d" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem", color: "#f9fafb" }}>AI Video Generator</h2>
          
          <form onSubmit={handleGenerate}>
            {/* Prompt Input */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#9ca3af", marginBottom: "0.5rem" }}>
                Prompt Description
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A cinematic shot of a futuristic city at night while a flying car passes between skyscrapers, realistic lighting and rain..."
                rows={4}
                style={{ width: "100%", backgroundColor: "#1f2937", color: "#f9fafb", border: "1px solid #374151", borderRadius: "8px", padding: "0.75rem", fontSize: "0.95rem", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", color: "#9ca3af", fontSize: "0.875rem" }}>
              <span>8 seconds</span><span>•</span><span>720p</span><span>•</span><span>Phone portrait 9:16</span>
            </div>

            <button type="button" onClick={saveDraft} style={{ width: "100%", padding: "0.65rem", marginBottom: "0.75rem", borderRadius: "8px", border: "1px solid #374151", backgroundColor: "#1f2937", color: "#fff", fontWeight: "600", cursor: "pointer" }}>
              Save Draft
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGenerating}
              style={{
                width: "100%",
                padding: "0.875rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: isGenerating ? "#374151" : "#6366f1",
                color: "#ffffff",
                fontSize: "1rem",
                fontWeight: "700",
                cursor: isGenerating ? "not-allowed" : "pointer",
              }}
            >
              {isGenerating ? `Generating (${jobStatus})...` : "Generate Video"}
            </button>
          </form>

          {errorMessage && (
            <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#7f1d1d", color: "#fca5a5", borderRadius: "6px", fontSize: "0.875rem" }}>
              {errorMessage}
            </div>
          )}

          {drafts.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: "0.5rem" }}>Drafts</p>
              {drafts.map((draft) => (
                <div key={draft} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                  <button type="button" onClick={() => setPrompt(draft)} style={{ flex: 1, textAlign: "left", padding: "0.5rem", borderRadius: "6px", border: "1px solid #374151", backgroundColor: "#1f2937", color: "#d1d5db", cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{draft}</button>
                  <button type="button" onClick={() => deleteDraft(draft)} aria-label="Delete draft" style={{ border: 0, background: "transparent", color: "#f87171", cursor: "pointer" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Video Preview & Status Screen */}
        <div style={{ backgroundColor: "#111827", borderRadius: "16px", padding: "1.5rem", border: "1px solid #1f293d", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
          {generatedVideoUrl ? (
            <div style={{ width: "100%" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem", color: "#38bdf8" }}>Generated Deliverable</h3>
              <div style={{ position: "relative", width: "min(100%, 360px)", aspectRatio: "9 / 16", overflow: "hidden", borderRadius: "12px", backgroundColor: "#000", margin: "0 auto" }}>
                <video src={generatedVideoUrl} controls autoPlay loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", background: "linear-gradient(transparent 52%, rgba(0,0,0,.72) 100%)" }} />
                <div style={{ position: "absolute", zIndex: 3, right: 12, bottom: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, color: "white", textShadow: "0 1px 4px #000" }}>
                  <span style={{ fontSize: 25 }}>♡</span><span style={{ fontSize: 23 }}>◯</span><span style={{ fontSize: 22 }}>➤</span>
                </div>
                <div style={{ position: "absolute", zIndex: 3, left: 14, right: 60, bottom: 16, color: "white", textShadow: "0 1px 4px #000", pointerEvents: "none" }}>
                  <strong style={{ display: "block", marginBottom: 6 }}>Your profile</strong>
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>{prompt || "Your generated video"}</span>
                  <div style={{ fontSize: 11, marginTop: 8 }}>♫ Original sound</div>
                </div>
              </div>
            </div>
          ) : isGenerating ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", border: "4px solid #374151", borderTopColor: "#6366f1", borderRadius: "50%", margin: "0 auto 1rem", animation: "spin 1s linear infinite" }} />
              <p style={{ fontWeight: "600", fontSize: "1.1rem", color: "#f3f4f6" }}>Orchestrating Veo 3.1 Lite...</p>
              <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.5rem" }}>Status: <span style={{ color: "#38bdf8" }}>{jobStatus}</span></p>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#6b7280" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🎬</div>
              <p style={{ fontWeight: "500" }}>Your generated video preview will appear here</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
