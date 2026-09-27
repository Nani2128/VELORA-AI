import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { AspectRatio, CameraMovement, VisualStyle } from '../../types';
import { Slider } from '../../components/ui/Slider';
import { SlidersHorizontal, ChevronDown, ChevronUp, Video, Layers, Compass, Palette } from 'lucide-react';
import { ModelSelector } from '../../components/studio/ModelSelector';

export const GenerationSettings: React.FC = () => {
  const { settings, updateSettings, generationType } = useAppStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isVideo = generationType.includes('VIDEO');

  const aspectRatios: { ratio: AspectRatio; label: string; iconClass: string }[] = [
    { ratio: '16:9', label: '16:9 (Landscape)', iconClass: 'w-6 h-3.5' },
    { ratio: '9:16', label: '9:16 (Vertical)', iconClass: 'w-3.5 h-6' },
    { ratio: '1:1', label: '1:1 (Square)', iconClass: 'w-5 h-5' },
    { ratio: '4:3', label: '4:3 (Standard)', iconClass: 'w-5 h-4' },
    { ratio: '21:9', label: '21:9 (Cinematic)', iconClass: 'w-7 h-3' },
  ];

  const cameraMovements: { value: CameraMovement; label: string }[] = [
    { value: 'ORBIT', label: 'Orbit' },
    { value: 'PAN_LEFT', label: 'Pan Left' },
    { value: 'PAN_RIGHT', label: 'Pan Right' },
    { value: 'ZOOM_IN', label: 'Push In' },
    { value: 'ZOOM_OUT', label: 'Pull Out' },
    { value: 'CRANE', label: 'Crane Rise' },
    { value: 'STATIC', label: 'Static Lock' },
  ];

  const styles: { value: VisualStyle; label: string }[] = [
    { value: 'CINEMATIC', label: 'Cinematic 35mm' },
    { value: 'PHOTOREALISTIC', label: 'Photorealistic' },
    { value: 'ANALOG_FILM', label: 'Analog Grain' },
    { value: 'CONCEPT_ART', label: 'Concept Design' },
    { value: 'ANIME_STYLIZED', label: 'Stylized 3D' },
  ];

  return (
    <div className="w-full flex flex-col gap-5">
      {/* AI Model Engine Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)] tracking-wide uppercase flex items-center justify-between">
          <span>AI Model Engine</span>
        </label>
        <ModelSelector />
      </div>

      {/* Aspect Ratio */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-300 dark:text-slate-300 tracking-wide uppercase flex items-center justify-between">
          <span>Aspect Ratio</span>
          <span className="text-amber-400 font-mono-numbers">{settings.aspectRatio}</span>
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {aspectRatios.map((item) => {
            const isSelected = settings.aspectRatio === item.ratio;
            return (
              <button
                key={item.ratio}
                type="button"
                onClick={() => updateSettings({ aspectRatio: item.ratio })}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-[#10131B] border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`border-2 rounded-sm mb-1 ${item.iconClass} ${
                  isSelected ? 'border-amber-400' : 'border-slate-500'
                }`} />
                <span className="text-[10px] font-mono-numbers">{item.ratio}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Style Preset */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span>Aesthetic Model Preset</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {styles.map((st) => {
            const isSelected = settings.style === st.value;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => updateSettings({ style: st.value })}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left truncate transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/10 border-amber-500/40 text-white font-semibold'
                    : 'bg-[#10131B] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Video-Specific Controls: Duration & Camera Movement */}
      {isVideo && (
        <div className="flex flex-col gap-4 p-3.5 rounded-2xl bg-[#0E1119] border border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Video className="w-4 h-4" />
            <span>Temporal & Camera Direction</span>
          </div>

          {/* Duration Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Sequence Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {[4, 8, 16].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => updateSettings({ durationSeconds: sec })}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    settings.durationSeconds === sec
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-[#141724] border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {sec} Seconds
                </button>
              ))}
            </div>
          </div>

          {/* Camera Motion */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span>Camera Vector</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {cameraMovements.map((cam) => (
                <button
                  key={cam.value}
                  type="button"
                  onClick={() => updateSettings({ cameraMovement: cam.value })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                    settings.cameraMovement === cam.value
                      ? 'bg-white/10 border-white/20 text-amber-300 font-semibold'
                      : 'bg-[#141724] border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>
          </div>

          {/* Motion Strength */}
          <Slider
            label="Motion Latent Intensity"
            value={settings.motionStrength}
            min={1}
            max={10}
            unit=" / 10"
            onChange={(val) => updateSettings({ motionStrength: val })}
          />
        </div>
      )}

      {/* Quality Tier Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Output Fidelity</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateSettings({ quality: 'STANDARD' })}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              settings.quality === 'STANDARD'
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-[#10131B] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-xs font-semibold">Standard</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Rapid rendering preview</div>
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ quality: 'ULTRA_HD' })}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              settings.quality === 'ULTRA_HD'
                ? 'bg-gradient-to-br from-amber-500/10 to-amber-900/20 border-amber-500/40 text-amber-300'
                : 'bg-[#10131B] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-xs font-semibold flex items-center justify-between">
              <span>Ultra HD (4K)</span>
              <span className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Maximum sharpness & color gamut</div>
          </button>
        </div>
      </div>

      {/* Collapsible Advanced Parameters */}
      <div className="pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 cursor-pointer"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Advanced Sampling Parameters</span>
          </span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAdvanced && (
          <div className="mt-3 flex flex-col gap-4 p-3.5 rounded-xl bg-[#0D0F16] border border-white/10 animate-in fade-in duration-150">
            <Slider
              label="Sampling Denoise Steps"
              value={settings.steps}
              min={20}
              max={60}
              step={5}
              unit=" steps"
              onChange={(steps) => updateSettings({ steps })}
            />

            {isVideo && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Framerate Target</label>
                <div className="grid grid-cols-3 gap-2">
                  {[24, 30, 60].map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => updateSettings({ fps: fps as 24 | 30 | 60 })}
                      className={`py-1.5 rounded-lg text-xs font-mono-numbers border transition-all cursor-pointer ${
                        settings.fps === fps
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-[#141724] border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
