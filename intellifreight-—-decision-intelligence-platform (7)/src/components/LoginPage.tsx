import React from 'react';
import {
  Ship,
  ShieldCheck,
  Compass,
  Anchor,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, isSigningIn, error, clearError } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Decorative Grid & Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-500/30">
            <Ship className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-lg">IntelliFreight</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/40">
                SIH 2026 Core
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">SIH26006 • East Coast India Bulk Procurement</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-300">Decision Intelligence Platform</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl relative">
          {/* Subtle Top Gradient Accent */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-t-2xl" />

          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white mb-4 shadow-xl shadow-blue-950/60 border border-cyan-400/30">
              <Ship className="w-7 h-7" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-white uppercase font-sans">
              INTELLIFREIGHT
            </h1>
            <h2 className="text-sm sm:text-base font-semibold text-cyan-400 tracking-wide mt-1">
              Chartering Decision Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
              Predict the Market. Validate the Voyage. Optimise the Charter.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-rose-300">{error.title}</div>
                  <div className="text-rose-200/90 mt-0.5 leading-relaxed">{error.message}</div>
                </div>
              </div>

              {error.actionGuide && (
                <div className="mt-2 pt-2 border-t border-rose-800/50 bg-rose-900/30 p-2.5 rounded-lg text-[11px] text-amber-200 font-sans">
                  <strong className="text-amber-300 block mb-1">Required Firebase Console Setup:</strong>
                  {error.actionGuide}
                </div>
              )}

              <button
                type="button"
                onClick={clearError}
                className="text-[11px] text-rose-300 underline hover:text-white pt-1 block"
              >
                Dismiss notice
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="space-y-4">
            <button
              id="btn-google-sign-in"
              onClick={loginWithGoogle}
              disabled={isSigningIn}
              className="w-full relative flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-lg shadow-white/10 transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-slate-800 font-semibold">Connecting with Google...</span>
                </>
              ) : (
                <>
                  {/* Google SVG Logo */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="font-bold tracking-tight text-slate-900 text-sm sm:text-base">
                    Continue with Google
                  </span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-[11px] text-slate-400">
                Secure access via Firebase Authentication. Persistent session enabled.
              </span>
            </div>
          </div>

          {/* Operational Capability Highlights */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Platform Modules Protected
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Executive Dashboard</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Freight Forecast (ML)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Port Feasibility Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Alternative Ports Map</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Voyage Cost & PDAs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Digital Twin Simulator</span>
              </div>
            </div>
          </div>

          {/* Trust Footnote */}
          <div className="mt-6 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Role-Based Security
            </span>
            <span>Zero-Trust Auth</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          IntelliFreight Decision Intelligence Platform • Smart India Hackathon 2026
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>Target: Hay Point → East Coast of India</span>
          <span>•</span>
          <span className="text-slate-400">Firebase Auth Ready</span>
        </div>
      </footer>
    </div>
  );
};
