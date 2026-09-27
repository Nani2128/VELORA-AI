import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from '../components/ui/Button';
import { Sparkles, Film, Image as ImageIcon, Compass, Layers, Sliders, Shield, Zap, ArrowRight } from 'lucide-react';

export const FeaturesPage: React.FC = () => {
  const { navigate } = useAppStore();

  const features = [
    {
      icon: ImageIcon,
      title: 'Photorealistic Image Latents',
      description: 'Generate high-resolution still frames with nuanced lighting, atmospheric haze, and fine surface textures across standard and custom aspect ratios.',
      highlights: ['Native 4K rendering', 'Custom aspect ratio matrix', 'Prompt enhancement engine'],
    },
    {
      icon: Film,
      title: 'Temporal Video Synthesis',
      description: 'Synthesize seamless video sequences with temporal consistency, realistic physics, and customizable frame rates (24, 30, and 60 fps).',
      highlights: ['4s, 8s, and 16s sequence lengths', 'Subtle motion latent intensity', 'Variable FPS output'],
    },
    {
      icon: Compass,
      title: '6-Axis Camera Vector Directing',
      description: 'Instruct virtual cinematography with dedicated vectors: Orbit, Pan Left/Right, Push In, Pull Out, and Crane Rise.',
      highlights: ['Smooth spline camera paths', 'Rotational stabilization', 'Static tripod locks'],
    },
    {
      icon: Layers,
      title: 'Curated Aesthetic Presets',
      description: 'Select from tested aesthetic styles including 35mm Analog Film, Concept Design, Ultra-Realistic, and Stylized 3D art.',
      highlights: ['Film grain emulation', 'Color gamut grading', 'Studio lighting calibration'],
    },
    {
      icon: Sliders,
      title: 'Granular Sampling Controls',
      description: 'Take full control over sampling denoise steps, negative prompting, and seed stability for consistent iteration.',
      highlights: ['Denoise step modulation', 'Negative constraint filters', 'Deterministic seeds'],
    },
    {
      icon: Zap,
      title: 'Instant Studio Viewport',
      description: 'Inspect generated assets with native interactive scrubbing, frame stepping, volume controls, and instant master downloads.',
      highlights: ['Zero-latency UI state updates', 'Timeline scrubbing', 'H.264 & PNG master export'],
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 flex flex-col gap-16">
      {/* Header */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Platform Architecture
        </span>
        <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-white mt-2 tracking-tight">
          Crafted for director-level precision
        </h1>
        <p className="text-sm sm:text-base text-slate-400 mt-4 leading-relaxed">
          Every tool inside VELORA AI was designed to eliminate creative friction and give creators predictable control over generative media.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div key={idx} className="flex flex-col p-6 rounded-2xl bg-[#0F121C] border border-white/10 hover:border-amber-500/25 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white tracking-tight">{feat.title}</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed flex-1">
                {feat.description}
              </p>
              <div className="pt-4 mt-4 border-t border-white/5 flex flex-col gap-1.5">
                {feat.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300 font-mono-numbers">
                    <span className="w-1 h-1 rounded-full bg-amber-400" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA Box */}
      <div className="p-8 rounded-3xl bg-[#121520] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div>
          <h3 className="text-xl font-bold text-white">Experience the Creative Studio</h3>
          <p className="text-xs text-slate-400 mt-1">Direct video camera vectors and synthesize 4K still frames now.</p>
        </div>
        <Button
          size="md"
          onClick={() => navigate('/app/create')}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Launch Workspace
        </Button>
      </div>
    </div>
  );
};
