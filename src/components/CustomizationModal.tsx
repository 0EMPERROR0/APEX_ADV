import React, { useState } from 'react';
import { AgentSettings, VoiceOption, SystemPersona } from '../types/agent';
import { X, Sliders, Volume2, Mic, Sun, Moon, Sparkles, Cpu, RotateCcw } from 'lucide-react';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AgentSettings;
  onUpdateSettings: (newSettings: Partial<AgentSettings>) => void;
  onResetSettings: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onTestVoice: (voice: VoiceOption) => void;
  isTestingVoice: boolean;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  isDark,
  onToggleTheme,
  onTestVoice,
  isTestingVoice,
}) => {
  if (!isOpen) return null;

  const voices: Array<{ id: VoiceOption; name: string; desc: string }> = [
    { id: 'Kore', name: 'Kore', desc: 'Clear, articulate, balanced' },
    { id: 'Puck', name: 'Puck', desc: 'Warm, dynamic, engaging' },
    { id: 'Charon', name: 'Charon', desc: 'Deep, resonant, measured' },
    { id: 'Fenrir', name: 'Fenrir', desc: 'Authoritative, precise, direct' },
    { id: 'Zephyr', name: 'Zephyr', desc: 'Gentle, soothing, calm' },
  ];

  const personas: Array<{ id: SystemPersona; title: string; desc: string }> = [
    {
      id: 'minimalist',
      title: 'A.P.E.X Minimalist',
      desc: 'High signal-to-noise ratio, razor-sharp brevity, pure insight.',
    },
    {
      id: 'architect',
      title: 'Systems Architect',
      desc: 'Deep structural engineering, modular decomposition, rigor.',
    },
    {
      id: 'futurist',
      title: 'Creative Futurist',
      desc: 'Visionary extrapolation, speculative tech, lateral innovation.',
    },
    {
      id: 'custom',
      title: 'Custom Instruction',
      desc: 'Define your own specialized persona and parameters.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-sky-500" />
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Agent Customization
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Appearance & Theme */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Theme & Interface
            </h3>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">Visual Mode</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Toggle between high-contrast obsidian dark and editorial alabaster light.
                </div>
              </div>
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dark Obsidian</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                    <span>Light Alabaster</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Voice Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Voice Personality (TTS)
              </h3>
              <button
                onClick={() => onTestVoice(settings.voice)}
                disabled={isTestingVoice}
                className="flex items-center gap-1.5 text-xs text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 font-medium disabled:opacity-50"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isTestingVoice ? 'Auditioning...' : 'Test Voice Audio'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {voices.map((v) => {
                const isSelected = settings.voice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onUpdateSettings({ voice: v.id })}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-1 ring-sky-500/50'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {v.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono uppercase text-sky-500 font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {v.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Persona Selection */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Cognitive Persona
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {personas.map((p) => {
                const isSelected = settings.systemPersona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onUpdateSettings({ systemPersona: p.id })}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-1 ring-sky-500/50'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {p.title}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {settings.systemPersona === 'custom' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Custom System Directives
                </label>
                <textarea
                  value={settings.customPrompt}
                  onChange={(e) => onUpdateSettings({ customPrompt: e.target.value })}
                  placeholder="You are an autonomous AI specialist in..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>
            )}
          </div>

          {/* Section 4: Sound Reactivity & Sensitivity */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Sound Reactive Calibration
            </h3>
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              {/* Audio Gain Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Input Gain Sensitivity
                  </span>
                  <span className="font-mono text-slate-500">{settings.gain.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={settings.gain}
                  onChange={(e) => onUpdateSettings({ gain: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Reactive Pulse Multiplier */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Orb Amplitude Displacement
                  </span>
                  <span className="font-mono text-slate-500">{settings.sensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={(e) => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={settings.autoSpeak}
                    onChange={(e) => onUpdateSettings({ autoSpeak: e.target.checked })}
                    className="rounded text-sky-500 focus:ring-sky-500"
                  />
                  <span>Speak answers with model voice</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={settings.noiseSuppression}
                    onChange={(e) => onUpdateSettings({ noiseSuppression: e.target.checked })}
                    className="rounded text-sky-500 focus:ring-sky-500"
                  />
                  <span>Mic noise suppression</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={onResetSettings}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors shadow-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
