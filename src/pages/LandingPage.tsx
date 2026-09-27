import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from '../components/ui/Button';
import { MediaPlaceholder } from '../components/common/MediaPlaceholder';
import { 
  Sparkles, 
  Film, 
  Image as ImageIcon, 
  Layers, 
  Compass, 
  ArrowRight, 
  Check, 
  Play, 
  Wand2, 
  ShieldCheck, 
  Zap, 
  FolderKanban 
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { navigate, setPrompt, setGenerationType } = useAppStore();

  const handleStartWithPrompt = (promptText: string, type: 'TEXT_TO_IMAGE' | 'TEXT_TO_VIDEO') => {
    setPrompt(promptText);
    setGenerationType(type);
    navigate('/app/create');
  };

  const showcaseItems = [
    {
      type: 'VIDEO' as const,
      title: 'Cinematic Anamorphic Soundstage',
      prompt: 'Slow dolly push-in across moody film set with amber volumetric lighting and glass reflections',
      aspectRatio: '16:9' as const,
      gradientTheme: 'from-amber-700/30 via-slate-900 to-slate-950',
      duration: 8,
    },
    {
      type: 'IMAGE' as const,
      title: 'Scandinavian Glass Pavilion',
      prompt: 'Minimalist glass villa nestled in misty pine forest at twilight with warm interior lighting',
      aspectRatio: '16:9' as const,
      gradientTheme: 'from-teal-800/30 via-slate-900 to-slate-950',
    },
    {
      type: 'IMAGE' as const,
      title: 'Haute Couture Architectural Silhouette',
      prompt: 'High-contrast monochrome studio fashion portrait with sculptural drapery, Leica 35mm',
      aspectRatio: '4:3' as const,
      gradientTheme: 'from-rose-800/30 via-neutral-900 to-zinc-950',
    },
    {
      type: 'VIDEO' as const,
      title: 'Prismatic Liquid Refraction',
      prompt: 'Macro fluid crystal dispersion in slow motion on black mirror surface',
      aspectRatio: '1:1' as const,
      gradientTheme: 'from-indigo-600/30 via-slate-900 to-slate-950',
      duration: 4,
    },
  ];

  return (
    <div className="flex flex-col w-full overflow-hidden">
      {/* 1. Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-4 md:px-8 py-16 md:py-24">
        {/* Subtle ambient lighting fields */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-500/10 via-amber-400/5 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[250px] bg-violet-600/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto flex flex-col items-center text-center z-10">
          {/* Subtle editorial kicker */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-amber-300 font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Studio Engine for High-Fidelity Visuals</span>
          </div>

          {/* Cinematic Headline */}
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white tracking-tight leading-[1.08] max-w-4xl text-balance">
            Turn creative vision into <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">living cinema</span>.
          </h1>

          {/* Supporting Copy */}
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mt-6 leading-relaxed">
            VELORA AI is a production studio for directors, designers, and visual creators.
            Synthesize master-grade images and fluid cinematic video with camera vector control.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
            <Button
              size="lg"
              onClick={() => navigate('/app/create')}
              leftIcon={<Sparkles className="w-4 h-4" />}
              className="w-full sm:w-auto shadow-xl shadow-amber-500/20"
            >
              Start Creating
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/showcase')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Explore Showcase
            </Button>
          </div>

          {/* Clean Proof Trust Markers */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-slate-400 font-mono-numbers">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>Native 4K UHD Synthesis</span>
            </div>
            <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>Full 6-Axis Camera Directing</span>
            </div>
            <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>Pro Color Grading Presets</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Studio Simulation Demo */}
      <section className="px-4 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <div className="rounded-3xl bg-[#0D0F17] border border-white/10 p-4 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Interactive Studio Preview
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-white mt-1">
                From descriptive nuance to living viewport
              </h2>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/app/create')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Open Studio Workspace
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-center">
            {/* Input simulation */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-[#141724] border border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Creative Directive</span>
                  <span className="font-mono-numbers">Prompt Mode: Image to Video</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-black/30 p-3 rounded-xl border border-white/5">
                  "Slow 35mm anamorphic tracking shot drifting past brutalist glass architecture, morning haze, golden hour rim lighting."
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono-numbers text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Aspect: 16:9</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Motion: Orbit Vector</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Color: 35mm Film</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-400">Try these one-click inspirations:</span>
                <button
                  onClick={() => handleStartWithPrompt('Brutalist concrete architecture reflected on calm rain-soaked slate at dusk', 'TEXT_TO_IMAGE')}
                  className="text-left text-xs p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-slate-300 transition-colors cursor-pointer"
                >
                  "Brutalist concrete villa reflected on calm rain-soaked slate at dusk"
                </button>
                <button
                  onClick={() => handleStartWithPrompt('Anamorphic drone drift through a futuristic high-tech vertical conservatory', 'TEXT_TO_VIDEO')}
                  className="text-left text-xs p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-slate-300 transition-colors cursor-pointer"
                >
                  "Anamorphic drone drift through a futuristic high-tech vertical conservatory"
                </button>
              </div>
            </div>

            {/* Viewport simulation */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black/60 shadow-2xl">
                <MediaPlaceholder
                  type="VIDEO"
                  title="Studio Simulation Master"
                  aspectRatio="16:9"
                  gradientTheme="from-amber-600/30 via-slate-900 to-slate-950"
                  duration={8}
                  className="rounded-none border-0"
                />
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono-numbers text-amber-300 flex items-center gap-1.5">
                  <Play className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>Viewport Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Studio Features */}
      <section className="px-4 md:px-8 py-20 max-w-6xl mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Engine Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mt-2">
            Engineered for creative precision
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mt-3">
            Every control is tuned to give you repeatable, cinematic authority over style, framing, and motion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col p-6 rounded-2xl bg-[#0F121C] border border-white/10 hover:border-white/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Image Synthesis</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Generate photorealistic, conceptual, and editorial portraits with precise control over aspect ratios and lighting nuance.
            </p>
          </div>

          <div className="flex flex-col p-6 rounded-2xl bg-[#0F121C] border border-white/10 hover:border-white/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
              <Film className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Cinematic Video Latents</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Direct realistic camera motion including pan, orbit, push-in, and crane ascents without temporal jitter.
            </p>
          </div>

          <div className="flex flex-col p-6 rounded-2xl bg-[#0F121C] border border-white/10 hover:border-white/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Project Organization</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Collate shots into production projects, maintain iterative histories, and export master files seamlessly.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Showcase Gallery */}
      <section className="px-4 md:px-8 py-16 bg-[#0B0D14] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Studio Output
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
                Created with VELORA AI
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/showcase')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Full Gallery
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {showcaseItems.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-2 group cursor-pointer" onClick={() => navigate('/app/create')}>
                <div className="rounded-xl overflow-hidden border border-white/10 group-hover:border-amber-500/30 transition-all">
                  <MediaPlaceholder
                    type={item.type}
                    title={item.title}
                    aspectRatio={item.aspectRatio}
                    gradientTheme={item.gradientTheme}
                    duration={item.duration}
                  />
                </div>
                <h4 className="text-xs font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-numbers">
                  <span>{item.type}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.aspectRatio}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Production Workflow Section */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Creative Pipeline
          </span>
          <h2 className="text-3xl font-display font-bold text-white mt-1">
            Five steps to visual mastery
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {[
            { step: '01', title: 'Describe or Upload', desc: 'Input textual prompts or supply reference frames' },
            { step: '02', title: 'Guide Direction', desc: 'Select camera vectors, aspect ratios, and color grading' },
            { step: '03', title: 'Synthesize', desc: 'Real state machine orchestrates latent pipeline' },
            { step: '04', title: 'Refine & Iterate', desc: 'Inspect outputs in native player with timeline control' },
            { step: '05', title: 'Export Master', desc: 'Download high-bitrate video or 4K image assets' },
          ].map((s) => (
            <div key={s.step} className="flex flex-col p-4 rounded-xl bg-[#0F121C] border border-white/5">
              <span className="font-mono-numbers text-xs text-amber-400 font-bold mb-2">{s.step}</span>
              <h4 className="text-xs font-semibold text-white mb-1">{s.title}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Final Call to Action */}
      <section className="px-4 md:px-8 py-20 bg-gradient-to-b from-transparent via-amber-500/[0.03] to-transparent">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-[#141824] to-[#0D101A] border border-white/10 p-8 sm:p-12 text-center flex flex-col items-center relative overflow-hidden shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white max-w-xl text-balance">
            Begin creating cinematic visuals today
          </h2>
          <p className="text-sm text-slate-400 max-w-md mt-3 mb-8">
            Experience the full studio suite with interactive presets, instant playback, and flexible exports.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/app/create')}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="shadow-xl shadow-amber-500/25"
          >
            Launch Creative Studio
          </Button>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="w-full border-t border-white/[0.08] px-4 md:px-8 py-10 bg-[#07080D] text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white text-sm">VELORA AI</span>
            <span>· High-Fidelity Creation Studio</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/features')} className="hover:text-white transition-colors cursor-pointer">
              Capabilities
            </button>
            <button onClick={() => navigate('/showcase')} className="hover:text-white transition-colors cursor-pointer">
              Showcase
            </button>
            <button onClick={() => navigate('/pricing')} className="hover:text-white transition-colors cursor-pointer">
              Pricing
            </button>
            <button onClick={() => navigate('/app/settings')} className="hover:text-white transition-colors cursor-pointer">
              Preferences
            </button>
          </div>

          <div className="font-mono-numbers text-[11px] text-slate-500">
            © 2026 VELORA AI Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
