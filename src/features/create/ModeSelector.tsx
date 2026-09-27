import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { GenerationType } from '../../types';
import { Sparkles, Image as ImageIcon, Video, Film } from 'lucide-react';

export const ModeSelector: React.FC = () => {
  const { generationType, setGenerationType } = useAppStore();

  const modes: { type: GenerationType; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      type: 'TEXT_TO_IMAGE',
      label: 'Text to Image',
      icon: <Sparkles className="w-4 h-4" />,
      desc: 'High-fidelity stills from descriptive prompts',
    },
    {
      type: 'IMAGE_TO_IMAGE',
      label: 'Image to Image',
      icon: <ImageIcon className="w-4 h-4" />,
      desc: 'Restyle, refine, or transform existing artwork',
    },
    {
      type: 'IMAGE_TO_VIDEO',
      label: 'Image to Video',
      icon: <Film className="w-4 h-4" />,
      desc: 'Animate still photographs with camera motion',
    },
    {
      type: 'TEXT_TO_VIDEO',
      label: 'Text to Video',
      icon: <Video className="w-4 h-4" />,
      desc: 'Direct cinematic video clips purely from text',
    },
  ];

  return (
    <div className="w-full flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
        Creation Mode
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {modes.map((mode) => {
          const isSelected = generationType === mode.type;

          return (
            <button
              key={mode.type}
              onClick={() => setGenerationType(mode.type)}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none group relative overflow-hidden ${
                isSelected
                  ? 'bg-gradient-to-b from-[#1E2333] to-[#151926] border-amber-500/40 shadow-md shadow-amber-500/5'
                  : 'bg-[#10131C] border-white/[0.08] hover:border-white/20 hover:bg-[#141724]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600" />
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/5 text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {mode.icon}
                </div>
                <span className={`text-xs font-semibold tracking-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {mode.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {mode.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
