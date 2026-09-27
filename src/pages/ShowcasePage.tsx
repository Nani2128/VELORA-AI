import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { MediaPlaceholder } from '../components/common/MediaPlaceholder';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Sparkles } from 'lucide-react';

export const ShowcasePage: React.FC = () => {
  const { navigate, setPrompt, setGenerationType } = useAppStore();
  const [filter, setFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');

  const gallery = [
    {
      id: 'sh-1',
      type: 'VIDEO' as const,
      title: 'Anamorphic Film Soundstage Orbit',
      prompt: 'Anamorphic slow cinematic dolly push through a foggy brutalist concrete pavilion with amber interior illumination',
      aspectRatio: '16:9' as const,
      gradientTheme: 'from-amber-700/35 via-slate-900 to-slate-950',
      duration: 8,
    },
    {
      id: 'sh-2',
      type: 'IMAGE' as const,
      title: 'Nordic Forest Pavilion at Twilight',
      prompt: 'Photorealistic modernist glass villa nestled in misty Scandinavian pine forest at dusk, warm glow on wet slate',
      aspectRatio: '16:9' as const,
      gradientTheme: 'from-teal-800/30 via-slate-900 to-slate-950',
    },
    {
      id: 'sh-3',
      type: 'IMAGE' as const,
      title: 'Sculptural Haute Couture Silhouette',
      prompt: 'Editorial fashion photography of a model in sculptural pleated silk, dramatic high-contrast window shadow, 35mm film',
      aspectRatio: '4:3' as const,
      gradientTheme: 'from-rose-800/30 via-neutral-900 to-zinc-950',
    },
    {
      id: 'sh-4',
      type: 'VIDEO' as const,
      title: 'Prismatic Liquid Refraction Dynamics',
      prompt: 'Macro slow-motion liquid crystal fluid dynamics, chromatic dispersion, obsidian glossy background',
      aspectRatio: '1:1' as const,
      gradientTheme: 'from-indigo-600/30 via-slate-900 to-slate-950',
      duration: 4,
    },
    {
      id: 'sh-5',
      type: 'IMAGE' as const,
      title: 'Solar Eclipse Volcanic Dunes',
      prompt: 'Geological survey perspective of black obsidian dunes, subtle corona glow, atmospheric low orbit lighting',
      aspectRatio: '21:9' as const,
      gradientTheme: 'from-orange-800/30 via-zinc-900 to-black',
    },
    {
      id: 'sh-6',
      type: 'VIDEO' as const,
      title: 'Monolithic Tower Sunrise Crane',
      prompt: 'Aerial drone crane shot ascending above geometric cantilevered skyscraper piercing through morning cloud sea',
      aspectRatio: '9:16' as const,
      gradientTheme: 'from-sky-700/30 via-slate-900 to-slate-950',
      duration: 16,
    },
  ];

  const filteredItems = gallery.filter((item) => {
    if (filter === 'ALL') return true;
    return item.type === filter;
  });

  const handleOpenPrompt = (prompt: string, type: 'IMAGE' | 'VIDEO') => {
    setPrompt(prompt);
    setGenerationType(type === 'VIDEO' ? 'TEXT_TO_VIDEO' : 'TEXT_TO_IMAGE');
    navigate('/app/create');
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Director Showcase
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white mt-1">
            Visual creations & camera vectors
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl">
            Explore outputs synthesized with VELORA AI presets, including temporal motion vectors and optical lighting styles.
          </p>
        </div>

        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All Media' },
            { value: 'IMAGE', label: 'Images' },
            { value: 'VIDEO', label: 'Videos' },
          ]}
        />
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col rounded-2xl bg-[#0F121C] border border-white/10 hover:border-amber-500/30 transition-all duration-200 overflow-hidden"
          >
            <div className="relative">
              <MediaPlaceholder
                type={item.type}
                title={item.title}
                aspectRatio={item.aspectRatio}
                gradientTheme={item.gradientTheme}
                duration={item.duration}
                className="rounded-b-none border-0"
              />
            </div>

            <div className="p-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                {item.title}
              </h3>
              
              {/* Zero-Pill clean metadata */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-numbers">
                <span>{item.type}</span>
                <span aria-hidden="true">·</span>
                <span>{item.aspectRatio}</span>
                {item.duration && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>00:0{item.duration}</span>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                "{item.prompt}"
              </p>

              <div className="pt-3 mt-1 border-t border-white/5 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleOpenPrompt(item.prompt, item.type)}
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  className="text-xs px-2"
                >
                  Use Directive
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
