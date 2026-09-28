import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, ViewTab } from './components/Navigation';
import { CharteringAnalysisForm } from './components/CharteringAnalysisForm';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { MarketIntelligenceView } from './components/MarketIntelligenceView';
import { FreightForecastView } from './components/FreightForecastView';
import { VesselOptimizerView } from './components/VesselOptimizerView';
import { PortFeasibilityView } from './components/PortFeasibilityView';
import { VoyageCostView } from './components/VoyageCostView';
import { ContractOptimizerView } from './components/ContractOptimizerView';
import { DigitalTwinView } from './components/DigitalTwinView';
import { ScenarioLabView } from './components/ScenarioLabView';
import { RiskCentreView } from './components/RiskCentreView';
import { RouteOptimizerView } from './components/RouteOptimizerView';
import { ESGView } from './components/ESGView';
import { DecisionMemoryView } from './components/DecisionMemoryView';
import { DataCentreView } from './components/DataCentreView';
import { ModelPerformanceView } from './components/ModelPerformanceView';
import { SettingsView } from './components/SettingsView';
import { LoginPage } from './components/LoginPage';
import { AuthProvider, useAuth } from './context/AuthContext';

import {
  CharteringAnalysisRequest,
  CharteringAnalysisResponse,
  Port,
  Vessel,
  MarketIndices,
  DatasetMeta,
  DecisionRecord,
  LiveMarketIntelligenceSummary,
} from './types';
import {
  fetchCharteringAnalysis,
  fetchPorts,
  fetchVessels,
  fetchMarketIndices,
  fetchDatasets,
  fetchDecisions,
  fetchLiveMarketSummary,
} from './services/api';
import { PORTS, VESSELS, MARKET_INDICES, DATASETS_CATALOGUE, INITIAL_DECISION_MEMORY } from './data/maritimeData';
import { runCompleteCharteringPipeline, createDecisionRecordFromResponse } from './services/pipelineCoordinator';
import { Sliders, ChevronUp, ChevronDown, Loader2, Ship } from 'lucide-react';

const DEFAULT_REQUEST: CharteringAnalysisRequest = {
  commodity: 'Coking Coal',
  cargoQuantityTonnes: 70000,
  numberOfVoyages: 4,
  originPortId: 'au-hpt',
  destinationPortId: 'in-dhm',
  deliveryWindowStart: '2026-10-01',
  deliveryWindowEnd: '2026-12-31',
  contractHorizonPreference: 'flexible',
  optimizationPreference: 'balanced',
  includeCarbonCost: true,
};

function AppContent() {
  const { currentUser, loading } = useAuth();

  const [currentView, setCurrentView] = useState<ViewTab>('executive');
  const [ports, setPorts] = useState<Port[]>(PORTS);
  const [vessels, setVessels] = useState<Vessel[]>(VESSELS);
  const [marketIndices, setMarketIndices] = useState<MarketIndices>(MARKET_INDICES);
  const [liveMarketSummary, setLiveMarketSummary] = useState<LiveMarketIntelligenceSummary | null>(null);
  const [isLoadingLiveMarket, setIsLoadingLiveMarket] = useState<boolean>(false);
  const [datasets, setDatasets] = useState<DatasetMeta[]>(DATASETS_CATALOGUE);
  const [decisions, setDecisions] = useState<DecisionRecord[]>(INITIAL_DECISION_MEMORY);

  const [currentRequest, setCurrentRequest] = useState<CharteringAnalysisRequest>(DEFAULT_REQUEST);
  const [analysisResult, setAnalysisResult] = useState<CharteringAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isFormCollapsed, setIsFormCollapsed] = useState<boolean>(false);

  // Initial load once authenticated
  useEffect(() => {
    if (!currentUser) return;

    async function initData() {
      const [fetchedPorts, fetchedVessels, fetchedMarket, fetchedDatasets, fetchedDecisions, fetchedLiveMarket] =
        await Promise.all([
          fetchPorts(),
          fetchVessels(),
          fetchMarketIndices(),
          fetchDatasets(),
          fetchDecisions(),
          fetchLiveMarketSummary(),
        ]);

      setPorts(fetchedPorts);
      setVessels(fetchedVessels);
      setMarketIndices(fetchedMarket);
      setDatasets(fetchedDatasets);
      setDecisions(fetchedDecisions);
      setLiveMarketSummary(fetchedLiveMarket);

      // Run initial baseline analysis
      runAnalysis(DEFAULT_REQUEST);
    }

    initData();
  }, [currentUser]);

  const runAnalysis = async (request: CharteringAnalysisRequest) => {
    setIsAnalyzing(true);
    setCurrentRequest(request);
    try {
      const result = await fetchCharteringAnalysis(request);
      setAnalysisResult(result);

      // Append to decision memory
      const record = createDecisionRecordFromResponse(result);
      setDecisions((prev) => [record, ...prev]);
    } catch (e) {
      console.error('Failed to run analysis, falling back locally', e);
      const fallbackResult = runCompleteCharteringPipeline(request);
      setAnalysisResult(fallbackResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateActualOutcome = (decisionId: string, actualRate: number, actualCost: number) => {
    setDecisions((prev) =>
      prev.map((d) => {
        if (d.id === decisionId) {
          const predRate = typeof d.predictedRateUsdPerTonne === 'number'
            ? d.predictedRateUsdPerTonne
            : typeof d.expectedRateUsdPerTonne === 'number'
            ? d.expectedRateUsdPerTonne
            : actualRate;
          const predCost = typeof d.predictedTotalCostUsd === 'number'
            ? d.predictedTotalCostUsd
            : typeof d.expectedTotalCostUsd === 'number'
            ? d.expectedTotalCostUsd
            : actualCost;
          const rateVariance = predRate > 0 ? ((actualRate - predRate) / predRate) * 100 : 0;
          const costVariance = predCost > 0 ? ((actualCost - predCost) / predCost) * 100 : 0;
          return {
            ...d,
            status: 'COMPLETED',
            actualOutcome: {
              actualRateUsdPerTonne: actualRate,
              actualRateAchievedUsd: actualRate,
              actualTotalCostUsd: actualCost,
              rateVariancePct: Number(rateVariance.toFixed(1)),
              costVariancePct: Number(costVariance.toFixed(1)),
              recordedAt: new Date().toISOString(),
              notes: 'Actual fixture outcome recorded by freight desk',
            },
          };
        }
        return d;
      })
    );
  };

  const handleRefreshLiveMarket = async () => {
    setIsLoadingLiveMarket(true);
    try {
      const freshSummary = await fetchLiveMarketSummary();
      if (freshSummary) {
        setLiveMarketSummary(freshSummary);
      }
    } finally {
      setIsLoadingLiveMarket(false);
    }
  };

  // 1. Authentication Loading State: Prevents flash of dashboard while Firebase checks session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-cyan-950/80 border border-cyan-400/30 mb-5 animate-pulse">
            <Ship className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white mb-1 uppercase">IntelliFreight</h2>
          <p className="text-xs text-cyan-400 font-semibold mb-6">Chartering Decision Intelligence</p>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-md">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            <span className="font-mono">Verifying Authentication Session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Route protection ensures unauthenticated users only see Login Page
  if (!currentUser) {
    return <LoginPage />;
  }

  // 3. Authenticated State: Full IntelliFreight Application
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        marketIndices={marketIndices}
        liveMarketSummary={liveMarketSummary}
        activeView={currentView}
        onRunDemo={() => runAnalysis(DEFAULT_REQUEST)}
        isAnalyzing={isAnalyzing}
      />

      <div className="flex-1 flex overflow-hidden">
        <Navigation
          currentView={currentView}
          onSelectView={(v) => setCurrentView(v)}
          hasActiveResult={!!analysisResult}
        />

        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 lg:p-6 space-y-6">
          {/* Top Global Parameter Collapsible Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsFormCollapsed(!isFormCollapsed)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cargo & Voyage Input Parameters</span>
                {isFormCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Active Cargo:</span>
                <span className="font-semibold text-white">
                  {(currentRequest.cargoQuantityTonnes * currentRequest.numberOfVoyages).toLocaleString()} MT {currentRequest.commodity} ({currentRequest.numberOfVoyages}x)
                </span>
              </div>
            </div>

            {!isFormCollapsed && (
              <CharteringAnalysisForm
                ports={ports}
                initialRequest={currentRequest}
                onRunAnalysis={runAnalysis}
                isAnalyzing={isAnalyzing}
              />
            )}
          </div>

          {/* View Content Renderer */}
          {isAnalyzing && !analysisResult ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-sm font-semibold">Running Multi-Horizon Analytics Pipeline...</p>
            </div>
          ) : analysisResult ? (
            <>
              {currentView === 'executive' && (
                <ExecutiveDashboard
                  analysis={analysisResult}
                  marketIndices={marketIndices}
                  liveMarketSummary={liveMarketSummary}
                  onNavigateTab={(view: ViewTab) => setCurrentView(view)}
                />
              )}

              {currentView === 'contract_optimizer' && (
                <ContractOptimizerView analysis={analysisResult} />
              )}

              {currentView === 'forecast' && (
                <FreightForecastView
                  initialForecast={analysisResult.freightForecast}
                  routeId={analysisResult.route.id}
                  vesselClass={analysisResult.recommendedVessel.vesselClass}
                />
              )}

              {currentView === 'voyage_cost' && (
                <VoyageCostView analysis={analysisResult} />
              )}

              {currentView === 'vessels' && (
                <VesselOptimizerView analysis={analysisResult} />
              )}

              {currentView === 'feasibility' && <PortFeasibilityView />}

              {currentView === 'route_optimizer' && (
                <RouteOptimizerView analysis={analysisResult} />
              )}

              {currentView === 'risk_centre' && (
                <RiskCentreView analysis={analysisResult} />
              )}

              {currentView === 'digital_twin' && (
                <DigitalTwinView analysis={analysisResult} />
              )}

              {currentView === 'scenario_lab' && (
                <ScenarioLabView analysis={analysisResult} />
              )}

              {currentView === 'esg' && <ESGView analysis={analysisResult} />}

              {currentView === 'market' && (
                <MarketIntelligenceView
                  marketIndices={marketIndices}
                  liveSummary={liveMarketSummary}
                  onRefreshLiveData={handleRefreshLiveMarket}
                  isLoadingLiveData={isLoadingLiveMarket}
                />
              )}

              {currentView === 'decision_memory' && (
                <DecisionMemoryView
                  decisions={decisions}
                  onUpdateActualOutcome={handleUpdateActualOutcome}
                />
              )}

              {currentView === 'data_centre' && (
                <DataCentreView datasets={datasets} />
              )}

              {currentView === 'model_performance' && (
                <ModelPerformanceView forecast={analysisResult?.freightForecast} />
              )}

              {currentView === 'settings' && <SettingsView />}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
