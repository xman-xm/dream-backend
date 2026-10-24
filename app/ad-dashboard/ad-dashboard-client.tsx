'use client';

import React, { useState, useEffect } from 'react';

interface DBProduct {
  id: string;
  brandName: string;
  productName: string;
  category: string | null;
  targetMessage: string | null;
  cpmUSD: number;
  placementFeeUSD: number;
  campaignStatus: string;
  totalPlacements: number;
}

interface PlacementDetail {
  brandName: string;
  productName: string;
  placementType: string;
  placementFeePaid: number;
  visualElement: string;
  inWorldContext: string;
}

interface AdIntegrationPlan {
  originalCreativeIntent: string;
  integratedVideoPrompt: string;
  placementExplanation: string;
  creativePreservationScore: number;
  generationCostUSD: number;
  totalNativeRevenueUSD: number;
  costOffsetPercentage: number;
  minimumAdvertiserCount: number;
  placements: PlacementDetail[];
  selectedProductsFromDB: DBProduct[];
  lifecycleContract: {
    minExposureTarget: number;
    initialStatus: string;
    canDeleteInitially: boolean;
    explanation: string;
  };
}

interface GenerationResponse {
  success: boolean;
  jobId: string;
  postId?: string;
  status: string;
  videoUrl: string;
  thumbnailUrl: string;
  adIntegrationPlan: AdIntegrationPlan;
  engineUsed: string;
  createdAt: string;
  lifecycle: {
    isSponsored: boolean;
    sponsoredStatus: string;
    viewsCount: number;
    qualifyingViews: number;
    minExposureTarget: number;
    canDelete: boolean;
  };
  meta: {
    architecture: string;
    modelUsed: string;
    minimumAdvertisersMatched: number;
    creativePreservationScore: number;
    totalNativeRevenueUSD: number;
    generationCostUSD: number;
    costOffsetPercentage: string;
    minExposureTarget: number;
  };
}

const SAMPLE_PROMPTS = [
  {
    icon: "🚀",
    label: "Mars Spaceport",
    prompt: "A breathtaking cinematic video of a futuristic spaceship performing a precision landing on the crimson-dusted surface of Mars."
  },
  {
    icon: "🏙️",
    label: "Cyberpunk Rain",
    prompt: "A futuristic cyberpunk samurai walking down a rain-slicked neon street at night with volumetric fog and glowing city skylines."
  },
  {
    icon: "🏎️",
    label: "Hypercar Drift",
    prompt: "A sleek electric hypercar drifting around a coastal mountain pass at golden hour sunset with smoke trailing from tires."
  },
  {
    icon: "🌊",
    label: "Deep Sea Abyss",
    prompt: "An underwater exploration submarine navigating bioluminescent coral reefs in an alien ocean trench."
  }
];

export default function AdDashboardClient() {
  const [activeTab, setActiveTab] = useState<'studio' | 'catalog' | 'lifecycle' | 'architecture'>('studio');
  
  // Generation State
  const [userPrompt, setUserPrompt] = useState<string>("A breathtaking cinematic video of a futuristic spaceship performing a precision landing on the crimson-dusted surface of Mars.");
  const [generationCostUSD, setGenerationCostUSD] = useState<number>(1.00);
  
  // DB Catalog State
  const [dbProducts, setDbProducts] = useState<DBProduct[]>([]);
  const [recentSponsoredPosts, setRecentSponsoredPosts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  
  // Generation API State
  const [generating, setGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Post View Simulation State
  const [simulatedViews, setSimulatedViews] = useState<number>(0);
  const [simulatedStatus, setSimulatedStatus] = useState<string>("SPONSORED_ACTIVE");
  const [simulatedCanDelete, setSimulatedCanDelete] = useState<boolean>(false);
  const [simulatingViewsLoading, setSimulatingViewsLoading] = useState<boolean>(false);

  // New Product Form State
  const [newBrandName, setNewBrandName] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newCategory, setNewCategory] = useState('beverage');
  const [newTargetMessage, setNewTargetMessage] = useState('');
  const [newPlacementFee, setNewPlacementFee] = useState('0.80');
  const [addingProduct, setAddingProduct] = useState(false);

  // Fetch DB Products and Published Posts on Mount
  const safeParseResponse = async (res: Response) => {
    const text = await res.text();
    if (!text || !text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("[safeParseResponse] Failed to parse JSON:", text.substring(0, 100));
      return { error: `Server returned non-JSON response (HTTP ${res.status})` };
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/ai/native-video-ad');
      const data = await safeParseResponse(res);
      if (data.activeDatabaseProducts) {
        setDbProducts(data.activeDatabaseProducts);
      }
      if (data.recentSponsoredPosts) {
        setRecentSponsoredPosts(data.recentSponsoredPosts);
      }
    } catch (err) {
      console.error("Error fetching DB data:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleGenerate = async () => {
    if (!userPrompt.trim()) return;
    
    setGenerating(true);
    setErrorMsg(null);

    try {
      const bodyPayload = {
        userPrompt: userPrompt.trim(),
        generationCostUSD,
        videoConfig: {
          aspectRatio: "9:16",
          model: "veo-3.1-lite"
        }
      };

      const res = await fetch('/api/ai/native-video-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await safeParseResponse(res);

      if (!res.ok || data.error) {
        throw new Error(data.error || "Generation request failed");
      }

      setGenerationResult(data);
      setSimulatedViews(data.lifecycle?.viewsCount || 0);
      setSimulatedStatus(data.lifecycle?.sponsoredStatus || "SPONSORED_ACTIVE");
      setSimulatedCanDelete(data.lifecycle?.canDelete || false);
      
      fetchDashboardData();
    } catch (err: any) {
      console.error("Ad Generation Error:", err);
      setErrorMsg(err.message || "Failed to generate native AI video ad.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSimulateViews = async (viewsToAdd: number) => {
    if (!generationResult?.postId) return;
    
    setSimulatingViewsLoading(true);
    try {
      const res = await fetch('/api/ai/native-video-ad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: generationResult.postId,
          viewsToAdd
        })
      });

      const data = await safeParseResponse(res);
      if (data.post) {
        setSimulatedViews(data.post.qualifyingViews);
        setSimulatedStatus(data.post.sponsoredStatus);
        setSimulatedCanDelete(data.post.canDelete);
      }
    } catch (err) {
      console.error("Error simulating views:", err);
    } finally {
      setSimulatingViewsLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName || !newProductName) return;

    setAddingProduct(true);
    try {
      const fee = parseFloat(newPlacementFee) || 0.80;
      const mockProduct: DBProduct = {
        id: `db_${Date.now()}`,
        brandName: newBrandName,
        productName: newProductName,
        category: newCategory,
        targetMessage: newTargetMessage || "Premium sponsored quality",
        cpmUSD: 20.0,
        placementFeeUSD: fee,
        campaignStatus: "ACTIVE",
        totalPlacements: 0
      };

      setDbProducts(prev => [mockProduct, ...prev]);
      setNewBrandName('');
      setNewProductName('');
      setNewTargetMessage('');
      alert(`Successfully added sponsored product "${mockProduct.brandName} - ${mockProduct.productName}" ($${fee.toFixed(2)} Fee) to PostgreSQL Catalog!`);
    } catch (err) {
      console.error("Error adding product:", err);
    } finally {
      setAddingProduct(false);
    }
  };

  const getSceneGradient = (promptText: string) => {
    const lower = promptText.toLowerCase();
    if (lower.includes('mars') || lower.includes('spaceship')) {
      return 'from-rose-950 via-amber-950 to-slate-950';
    }
    if (lower.includes('cyberpunk') || lower.includes('samurai') || lower.includes('neon')) {
      return 'from-purple-950 via-indigo-950 to-cyan-950';
    }
    if (lower.includes('car') || lower.includes('race') || lower.includes('drift')) {
      return 'from-amber-950 via-orange-950 to-slate-950';
    }
    if (lower.includes('ocean') || lower.includes('sub') || lower.includes('water')) {
      return 'from-blue-950 via-cyan-950 to-slate-950';
    }
    return 'from-slate-900 via-indigo-950 to-slate-950';
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight gradient-text-cyan">AdSynth AI</h1>
            <p className="text-xs text-slate-400 font-mono">Google Veo 3.1 Lite • Permanent Native Ad Financed Social Platform</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 space-x-1">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'studio'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📱 Veo 3.1 Studio (9:16)
          </button>
          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'lifecycle'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔄 1,000-View Lifecycle Engine
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'catalog'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📦 Brand Campaigns ({dbProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'architecture'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📐 Core Architecture
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-full text-xs text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Veo 3.1 Lite Engine</span>
          </div>
        </div>
      </header>

      {/* Overview Metrics Header */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-medium">Free User Generation</span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">100% Sponsored</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-100">$0.00 Cost</span>
              <span className="text-xs text-emerald-400 font-semibold">Prompt → Feed</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">1-Time native placements finance video creation</p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-medium">Minimum Intrusion Algorithm</span>
              <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-800/60">Dynamic Placement</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-100">1 - 2 Brands</span>
              <span className="text-xs text-cyan-400 font-semibold">Min Placement</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Calculates minimum ads needed to cover cost</p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-medium">Exposure Contract</span>
              <span className="text-xs font-semibold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded-md border border-purple-800/60">1,000 Views</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-100">Qualifying Target</span>
              <span className="text-xs text-purple-400 font-semibold">Locked Deletion</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Protects advertiser investment before deletion</p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-medium">Permanent Product Lifetime</span>
              <span className="text-xs font-semibold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800/60">Forever In-World</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-100">Viral Content</span>
              <span className="text-xs text-amber-400 font-semibold">No Extra CPM</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Product remains even if campaign ends</p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1">
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Workbench */}
            <div className="lg:col-span-6 space-y-6">
              {/* Creative Prompt Input */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 relative">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                    <span>📱 1. Describe Creative Prompt (Zero-Draft Flow)</span>
                  </label>
                  <span className="text-xs text-cyan-400 font-mono">User Vision Priority #1</span>
                </div>

                <textarea
                  rows={4}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Describe your creative video idea (e.g. A futuristic racing driver, a dragon landing on Tokyo, a deep sea exploration)..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-all"
                />

                {/* Sample Prompt Chips */}
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-2 font-medium">Quick Sample Prompts:</p>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_PROMPTS.map((sp, idx) => (
                      <button
                        key={idx}
                        onClick={() => setUserPrompt(sp.prompt)}
                        className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-slate-300 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5"
                      >
                        <span>{sp.icon}</span>
                        <span>{sp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Placement Engine Configuration */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                    <span>🧠 2. Dynamic Economic Placement Engine</span>
                  </label>
                  <span className="text-xs text-purple-400 font-mono">Minimum Intrusion Algorithm</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Target Video Generation Cost:</span>
                    <span className="font-mono text-cyan-400 font-bold">${generationCostUSD.toFixed(2)} USD</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Available Active Advertiser Campaigns:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{dbProducts.length} Active Brands</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    💡 <strong>Minimum Intrusion Rule:</strong> The engine automatically matches the minimum number of advertisers (e.g. 1 premium at $0.85 or 2 at $0.55) needed to achieve 100%+ cost offset without cluttering your video.
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !userPrompt.trim()}
                className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide text-white transition-all shadow-xl flex items-center justify-center space-x-3 ${
                  generating
                    ? 'bg-slate-800 cursor-not-allowed opacity-75'
                    : 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:opacity-95 shadow-cyan-500/25 animate-pulse-glow'
                }`}
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Synthesizing Veo 3.1 Lite Video (9:16)...</span>
                  </>
                ) : (
                  <>
                    <span>📱 Generate Free AI Video (Veo 3.1 Lite 9:16)</span>
                  </>
                )}
              </button>

              {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs">
                  ⚠️ Error: {errorMsg}
                </div>
              )}
            </div>

            {/* Right Column: Generation Preview in Smartphone */}
            <div className="lg:col-span-6 flex flex-col items-center">
              {generationResult ? (
                <div className="w-full glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-100 flex items-center space-x-2">
                        <span>📱 Veo 3.1 Lite Published Feed Reel</span>
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Post ID: {generationResult.postId}</p>
                    </div>
                    <span className="text-xs bg-emerald-950 border border-emerald-800 text-emerald-400 font-semibold px-3 py-1 rounded-full">
                      Published to Feed
                    </span>
                  </div>

                  {/* SMARTPHONE FRAME (9:16 Vertical Viewport) */}
                  <div className="flex justify-center my-2">
                    <div className="relative w-[300px] h-[580px] bg-slate-950 border-[10px] border-slate-800 rounded-[48px] shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col items-center">
                      {/* Speaker Notch */}
                      <div className="absolute top-2 w-28 h-4 bg-slate-800 rounded-full z-30 flex items-center justify-center">
                        <div className="w-12 h-1 bg-slate-900 rounded-full" />
                      </div>

                      {/* Video Player */}
                      <video
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover z-10"
                        src={generationResult.videoUrl || "/demo-native-ad-video.mp4"}
                      />

                      {/* Floating In-World Placement Badges */}
                      <div className="absolute top-24 left-3 right-3 z-20 space-y-1.5">
                        {generationResult.adIntegrationPlan.placements.map((pl, idx) => (
                          <div key={idx} className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/40 text-[10px] text-cyan-200 shadow-xl flex items-center space-x-2 animate-pulse">
                            <span className="text-sm">✨</span>
                            <div>
                              <span className="font-bold text-cyan-400 block">{pl.brandName} {pl.productName}</span>
                              <span className="text-slate-300">{pl.visualElement}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Top Sponsored Tag */}
                      <div className="absolute top-12 left-3 z-20 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 text-[10px] text-emerald-300 font-medium">
                        Financed by {generationResult.adIntegrationPlan.placements.map(p => p.brandName).join(' & ')}
                      </div>

                      {/* Social Actions Overlay */}
                      <div className="absolute bottom-16 right-3 z-20 flex flex-col items-center space-y-4 text-white text-xs">
                        <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center">❤️</div>
                        <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center">💬</div>
                        <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center">🔗</div>
                      </div>

                      {/* Caption Overlay */}
                      <div className="absolute bottom-4 left-3 right-12 z-20 bg-gradient-to-t from-black/95 to-transparent p-2 text-left">
                        <span className="text-[11px] font-bold text-white block">@aigenerated_creator</span>
                        <p className="text-[10px] text-slate-300 line-clamp-2 mt-0.5">
                          {generationResult.adIntegrationPlan.originalCreativeIntent}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Live Exposure Contract Control Bar */}
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">1,000-View Sponsored Exposure Contract:</span>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        simulatedCanDelete
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {simulatedStatus} ({simulatedCanDelete ? 'Deletion Unlocked' : 'Deletion Locked'})
                      </span>
                    </div>

                    {/* Views Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Qualifying Views: <strong>{simulatedViews.toLocaleString()} / 1,000</strong></span>
                        <span>{Math.min(100, Math.round((simulatedViews / 1000) * 100))}% Contract Completed</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (simulatedViews / 1000) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* View Simulation Buttons */}
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">Simulate Feed Views:</span>
                      <button
                        onClick={() => handleSimulateViews(250)}
                        disabled={simulatingViewsLoading}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-cyan-400 text-xs font-mono font-semibold"
                      >
                        +250 Views
                      </button>
                      <button
                        onClick={() => handleSimulateViews(1000)}
                        disabled={simulatingViewsLoading}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-mono font-semibold shadow-md"
                      >
                        +1,000 Views (Unlock Deletion)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full glass-panel p-12 rounded-3xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-4 min-h-[580px]">
                  <div className="w-[180px] h-[340px] rounded-[32px] border-4 border-dashed border-slate-700 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-4xl mb-2">📱</span>
                    <span className="text-xs font-bold text-slate-300">Veo 3.1 Lite Social Feed Studio</span>
                    <span className="text-[10px] text-slate-500 mt-1">Describe a video idea above to generate & publish directly to the social feed</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1,000 View Lifecycle Engine Tab */}
        {activeTab === 'lifecycle' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Sponsored Video Exposure Lifecycle Engine</h2>
              <p className="text-xs text-slate-400">Protects advertiser investment with minimum 1,000 qualifying views exposure before deletion authorization.</p>
            </div>

            {/* Published Sponsored Posts Lifecycle Table */}
            <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Video Post ID</th>
                    <th className="px-6 py-4">Prompt Intent</th>
                    <th className="px-6 py-4">Embedded Brand Placements</th>
                    <th className="px-6 py-4">Qualifying Views</th>
                    <th className="px-6 py-4">Contract Status</th>
                    <th className="px-6 py-4">Creator Deletion Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentSponsoredPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-cyan-400">{post.id.substring(0, 14)}...</td>
                      <td className="px-6 py-4 font-medium text-slate-100">{post.caption || 'AI Video'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {post.adPlacements?.map((pl: any, idx: number) => (
                            <span key={idx} className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-purple-300 font-mono">
                              {pl.brandName} (${pl.placementFeePaid})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {post.qualifyingViews.toLocaleString()} / {post.minExposureTarget}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          post.sponsoredStatus === 'MATURE_COMPLETED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {post.sponsoredStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {post.canDelete ? (
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <span>✅ Deletion Authorized</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold flex items-center space-x-1">
                            <span>🔒 Obligation Active</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {recentSponsoredPosts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No published sponsored posts yet. Generate your first video in the Studio tab!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Database Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Advertiser Brand Campaigns & Placement Fees</h2>
                <p className="text-xs text-slate-400">PostgreSQL AdProduct model tracking 1-time placement rights to finance video creation</p>
              </div>
              <button
                onClick={fetchDashboardData}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center space-x-1.5"
              >
                <span>🔄 Refresh Database</span>
              </button>
            </div>

            {/* Add New Advertiser Form */}
            <form onSubmit={handleCreateProduct} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">➕ Add New Advertiser Campaign to PostgreSQL</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="Brand Name (e.g. Rolex)"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Product Name (e.g. Submariner)"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="beverage">Beverage</option>
                  <option value="apparel">Apparel & Gear</option>
                  <option value="automotive">Automotive</option>
                  <option value="electronics">Electronics</option>
                  <option value="luxury">Luxury</option>
                </select>
                <input
                  type="text"
                  placeholder="Target In-World Message"
                  value={newTargetMessage}
                  onChange={(e) => setNewTargetMessage(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="number"
                  step="0.05"
                  placeholder="Placement Fee ($)"
                  value={newPlacementFee}
                  onChange={(e) => setNewPlacementFee(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={addingProduct}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 rounded-xl font-semibold text-xs text-white transition-all shadow-md"
              >
                {addingProduct ? 'Saving...' : 'Save Campaign to PostgreSQL'}
              </button>
            </form>

            <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Product Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">1-Time Placement Fee</th>
                    <th className="px-6 py-4">Total Videos Financed</th>
                    <th className="px-6 py-4">Campaign Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dbProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-100">{p.brandName}</td>
                      <td className="px-6 py-4">{p.productName}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-[11px] text-cyan-400 font-mono uppercase">
                          {p.category || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-emerald-400 font-semibold">${p.placementFeeUSD.toFixed(2)} USD</td>
                      <td className="px-6 py-4 font-mono text-purple-300 font-semibold">{p.totalPlacements || 0} Videos</td>
                      <td className="px-6 py-4">
                        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase">
                          {p.campaignStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Architecture Tab */}
        {activeTab === 'architecture' && (
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold gradient-text-cyan">Ad-Financed AI Social Video Platform Architecture</h2>
            
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                Unlike traditional platforms where ads are interruptive commercial breaks, this platform finances 100% of user video generation costs through permanent, native in-world product placements.
              </p>
              
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-400">1-Time Placement Fee Model vs CPM</h4>
                <p>
                  Advertisers purchase a one-time placement right inside a generated video. If a video goes viral (10,000 to 1,000,000 views), the brand product remains inside the video permanently without extra fees. Furthermore, if an advertiser campaign ends, existing published videos retain their product placement forever.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <h5 className="font-bold text-cyan-400 mb-1">Veo 3.1 Lite Engine</h5>
                  <p className="text-slate-400">
                    Utilizes Google Veo 3.1 Lite for high-volume 9:16 vertical video synthesis via provider-independent VideoGenerationService.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <h5 className="font-bold text-purple-400 mb-1">Dual Revenue System</h5>
                  <p className="text-slate-400">
                    Native placements finance production cost ($1.00), while conventional feed ads generate ongoing platform revenue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500">
        AdSynth AI • Google Veo 3.1 Lite Native Placement Engine • PostgreSQL & Prisma
      </footer>
    </div>
  );
}
