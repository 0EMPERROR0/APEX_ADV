import React from 'react';
import { Sun, Moon, Mic, MicOff, Sliders, MessageSquare, Sparkles } from 'lucide-react';
import { AgentState } from '../types/agent';

interface TopNavProps {
  isDark: boolean;
  onToggleTheme: () => void;
  activeTab: 'agent' | 'presets' | 'settings';
  onSelectTab: (tab: 'agent' | 'presets' | 'settings') => void;
  isListening: boolean;
  onToggleMic: () => void;
  agentState: AgentState;
  showTranscript: boolean;
  onToggleTranscript: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  isDark,
  onToggleTheme,
  activeTab,
  onSelectTab,
  isListening,
  onToggleMic,
  agentState,
  showTranscript,
  onToggleTranscript,
}) => {
  return (
    <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40 transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('agent')}
            className="flex items-center gap-2 text-left group"
          >
            <span className="font-display font-bold text-lg sm:text-xl tracking-wider text-slate-900 dark:text-white whitespace-nowrap">
              A.P.E.X
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onSelectTab('agent')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'agent'
                ? 'border-sky-500 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Agent Stage
          </button>
          <button
            onClick={() => onSelectTab('presets')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'presets'
                ? 'border-sky-500 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Presets
          </button>
          <button
            onClick={() => onSelectTab('settings')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'settings'
                ? 'border-sky-500 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Customization
          </button>
        </nav>

        {/* Zone 3: Actions & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Transcript Toggle Button */}
          <button
            onClick={onToggleTranscript}
            title={showTranscript ? 'Hide Live Transcript' : 'Show Live Transcript'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showTranscript
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-300'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {showTranscript ? 'Hide Transcript' : 'Live Transcript'}
            </span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Mobile settings button */}
          <button
            onClick={() => onSelectTab(activeTab === 'settings' ? 'agent' : 'settings')}
            aria-label="Settings"
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Voice Session */}
          <button
            onClick={onToggleMic}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap shrink-0 shadow-sm ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 animate-pulse text-white" />
                <span>End Voice</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Voice Session</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
