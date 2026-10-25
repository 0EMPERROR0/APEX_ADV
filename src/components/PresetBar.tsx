import React from 'react';
import { VisualizerPreset, PRESET_CONFIGS } from '../types/agent';
import { Sparkles, Radio, Activity, Cpu, Disc3 } from 'lucide-react';

interface PresetBarProps {
  currentPreset: VisualizerPreset;
  onSelectPreset: (preset: VisualizerPreset) => void;
}

const PRESET_ICONS: Record<VisualizerPreset, React.ReactNode> = {
  singularity: <Disc3 className="w-3.5 h-3.5" />,
  quantum_aurora: <Sparkles className="w-3.5 h-3.5" />,
  neural_pulse: <Activity className="w-3.5 h-3.5" />,
  cyber_wire: <Cpu className="w-3.5 h-3.5" />,
  harmonic_eclipse: <Radio className="w-3.5 h-3.5" />,
};

export const PresetBar: React.FC<PresetBarProps> = ({
  currentPreset,
  onSelectPreset,
}) => {
  const presets: VisualizerPreset[] = [
    'singularity',
    'quantum_aurora',
    'neural_pulse',
    'cyber_wire',
    'harmonic_eclipse',
  ];

  return (
    <div className="flex flex-col items-center gap-2 max-w-xl mx-auto px-4 w-full">
      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Sound Visualization Presets
      </div>
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto max-w-full">
        {presets.map((id) => {
          const cfg = PRESET_CONFIGS[id];
          const isSelected = currentPreset === id;
          return (
            <button
              key={id}
              onClick={() => onSelectPreset(id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: cfg.colors.secondary,
                  boxShadow: isSelected ? `0 0 8px ${cfg.colors.secondary}` : 'none',
                }}
              />
              <span className="hidden sm:inline">{cfg.name}</span>
              <span className="sm:hidden">{cfg.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
