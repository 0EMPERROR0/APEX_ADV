import React, { useState, useEffect, useCallback } from 'react';
import {
  AgentState,
  VisualizerPreset,
  AgentSettings,
  ChatMessage,
  ChatFile,
  VoiceOption,
  PRESET_CONFIGS,
} from './types/agent';
import { audioEngine } from './utils/audioEngine';
import { desktopBridge } from './utils/desktopBridge';
import { AudioOrb } from './components/AudioOrb';
import { TopNav } from './components/TopNav';
import { PresetBar } from './components/PresetBar';
import { PromptBar } from './components/PromptBar';
import { LiveTranscriptPane } from './components/HistoryDrawer';
import { CustomizationModal } from './components/CustomizationModal';
import { Sparkles, MessageSquare, ShieldAlert, PanelRightOpen } from 'lucide-react';

const DEFAULT_SETTINGS: AgentSettings = {
  voice: 'Kore',
  systemPersona: 'minimalist',
  customPrompt: '',
  temperature: 0.7,
  sensitivity: 1.1,
  gain: 1.3,
  turbulence: 1.0,
  glowIntensity: 1.0,
  autoSpeak: true,
  noiseSuppression: true,
};

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('apex_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  // Agent State
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [preset, setPreset] = useState<VisualizerPreset>(() => {
    return (localStorage.getItem('apex_preset') as VisualizerPreset) || 'singularity';
  });
  const [settings, setSettings] = useState<AgentSettings>(() => {
    const saved = localStorage.getItem('apex_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Navigation & Transcript visibility (always present on right side by default with option to hide)
  const [activeTab, setActiveTab] = useState<'agent' | 'presets' | 'settings'>('agent');
  const [showTranscript, setShowTranscript] = useState<boolean>(() => {
    const saved = localStorage.getItem('apex_show_transcript');
    return saved !== null ? saved === 'true' : true;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');

  // Sync theme with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('apex_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('apex_theme', 'light');
    }
  }, [isDark]);

  // Initialize desktop bridge if running inside native Windows PySide6 app
  useEffect(() => {
    desktopBridge.init().then((isDesktop) => {
      if (isDesktop) {
        desktopBridge.onStateChanged((state) => {
          if (['idle', 'listening', 'thinking', 'speaking', 'error'].includes(state)) {
            setAgentState(state as AgentState);
          }
        });
      }
    });
  }, []);

  // Persist settings, preset, and transcript visibility
  useEffect(() => {
    localStorage.setItem('apex_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('apex_preset', preset);
  }, [preset]);

  useEffect(() => {
    localStorage.setItem('apex_show_transcript', String(showTranscript));
  }, [showTranscript]);

  // Toggle microphone
  const handleToggleMic = useCallback(async () => {
    const active = await audioEngine.toggleMicrophone(settings.noiseSuppression);
    setIsListening(active);
    if (active) {
      desktopBridge.startVoiceSession();
      setAgentState('listening');
      setStatusText('LISTENING · AUDIO STREAM ACTIVE');
    } else {
      desktopBridge.stopVoiceSession();
      if (agentState === 'listening') {
        setAgentState('idle');
        setStatusText('');
      }
    }
  }, [settings.noiseSuppression, agentState]);

  // Handle clicking directly on the orb
  const handleOrbClick = useCallback(() => {
    if (agentState === 'speaking') {
      audioEngine.stopCurrentAudio();
      desktopBridge.emergencyStop();
      setAgentState('idle');
      setStatusText('');
    } else {
      handleToggleMic();
    }
  }, [agentState, handleToggleMic]);

  // Resolve system persona instruction
  const getSystemInstruction = () => {
    if (settings.systemPersona === 'custom' && settings.customPrompt.trim()) {
      return settings.customPrompt;
    }
    switch (settings.systemPersona) {
      case 'architect':
        return `You are A.P.E.X, a principal systems and computational architect. 
Deconstruct problems into first-principles structures, engineering specifications, and rigorous frameworks.
Maintain concise authority, technical depth, and pristine modular organization.`;
      case 'futurist':
        return `You are A.P.E.X, a creative technological futurist and visionary agent.
Synthesize cross-disciplinary concepts, speculative science, emerging paradigms, and lateral design ideas.
Deliver inspiring, boundary-pushing perspectives with lucid clarity.`;
      case 'minimalist':
      default:
        return `You are A.P.E.X, an elite autonomous multimodal agent.
You prioritize extreme signal-to-noise ratio, zero corporate fluff, and crisp direct intelligence.
When responding:
- Keep explanations elegant, razor-sharp, and visually structured.
- Use bullet points, succinct paragraphs, and clean code blocks where needed.`;
    }
  };

  // Submit prompt with optional files
  const handleSendPrompt = async (promptText: string, attachedFiles: ChatFile[]) => {
    if (!promptText && attachedFiles.length === 0) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText || '(Attached file analysis request)',
      files: attachedFiles,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsProcessing(true);
    setAgentState('thinking');
    setStatusText('THINKING · SYNTHESIZING INTELLIGENCE');
    setErrorMessage(null);

    try {
      const formattedMessages = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
        files: m.files?.map((f) => ({
          name: f.name,
          type: f.type,
          base64: f.base64,
        })),
      }));

      const data = await desktopBridge.sendMessage(
        formattedMessages,
        getSystemInstruction(),
        settings.temperature
      );

      if (data.error) {
        throw new Error(data.error || 'Failed to generate agent response');
      }

      const agentText = data.text || '';

      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: agentText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, modelMessage]);

      // If autoSpeak is enabled, trigger speech audio which makes the orb dynamically react!
      if (settings.autoSpeak && agentText.trim()) {
        setAgentState('speaking');
        setStatusText('SPEAKING · NEURAL VOCALIZATION');

        await audioEngine.speakText(agentText, settings.voice, () => {
          setAgentState(isListening ? 'listening' : 'idle');
          setStatusText(isListening ? 'LISTENING · AUDIO STREAM ACTIVE' : '');
        });
      } else {
        setAgentState(isListening ? 'listening' : 'idle');
        setStatusText(isListening ? 'LISTENING · AUDIO STREAM ACTIVE' : '');
      }
    } catch (err: any) {
      console.error('Agent chat error:', err);
      setAgentState('error');
      setStatusText('EXECUTION ERROR');
      setErrorMessage(err.message || 'An error occurred while contacting A.P.E.X.');
      setTimeout(() => {
        setAgentState(isListening ? 'listening' : 'idle');
        setStatusText(isListening ? 'LISTENING · AUDIO STREAM ACTIVE' : '');
      }, 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Replay voice audio on demand
  const handleReplayAudio = async (base64Audio: string) => {
    setAgentState('speaking');
    setStatusText('REPLAYING · SPEECH FREQUENCIES');
    await audioEngine.playWavAudio(base64Audio, () => {
      setAgentState(isListening ? 'listening' : 'idle');
      setStatusText(isListening ? 'LISTENING · AUDIO STREAM ACTIVE' : '');
    });
  };

  // Synthesize speech for an existing text message
  const handleSynthesizeSpeech = async (text: string) => {
    try {
      setAgentState('speaking');
      setStatusText('SPEAKING · NEURAL VOCALIZATION');
      await audioEngine.speakText(text, settings.voice, () => {
        setAgentState(isListening ? 'listening' : 'idle');
        setStatusText(isListening ? 'LISTENING · AUDIO STREAM ACTIVE' : '');
      });
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
      setAgentState('idle');
      setStatusText('');
    }
  };

  // Audition voice preview in settings
  const handleTestVoice = async (voice: VoiceOption) => {
    setIsTestingVoice(true);
    setAgentState('speaking');
    setStatusText(`AUDITIONING ${voice.toUpperCase()} VOICE`);
    try {
      const sampleText = `Hello. I am A.P.E.X operating on the ${voice} voice model. Real-time audio synthesis online.`;
      await audioEngine.speakText(sampleText, voice, () => {
        setIsTestingVoice(false);
        setAgentState(isListening ? 'listening' : 'idle');
        setStatusText(isListening ? 'LISTENING · AUDIO STREAM ACTIVE' : '');
      });
    } catch (e) {
      console.warn('Voice preview error:', e);
      setIsTestingVoice(false);
      setAgentState('idle');
      setStatusText('');
    }
  };

  const currentConfig = PRESET_CONFIGS[preset] || PRESET_CONFIGS.singularity;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-500 relative overflow-hidden ${
        isDark ? 'bg-[#07090e] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* Dynamic Background Atmosphere Glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/3 -translate-x-1/2 w-[700px] h-[600px] rounded-full blur-[140px] opacity-20 dark:opacity-30 transition-all duration-700"
        style={{ backgroundColor: currentConfig.colors.secondary }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 w-[500px] h-[500px] rounded-full blur-[160px] opacity-10 dark:opacity-20 transition-all duration-700"
        style={{ backgroundColor: currentConfig.colors.accent }}
      />

      {/* Top Bar Navigation */}
      <TopNav
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        isListening={isListening}
        onToggleMic={handleToggleMic}
        agentState={agentState}
        showTranscript={showTranscript}
        onToggleTranscript={() => setShowTranscript(!showTranscript)}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="max-w-xl mx-auto mt-3 px-4 w-full z-30">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Split Stage: Orb on Left/Center, Live Transcript on Right */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-2 sm:py-3 flex flex-col lg:flex-row gap-5 items-stretch relative z-10 overflow-hidden">
        {/* Left / Center Section: Presets, Sound Reactive Orb, and Prompt Bar */}
        <section className="flex-1 flex flex-col justify-between items-center min-w-0">
          {/* Presets Quick Strip */}
          <div className="w-full pt-1 pb-1">
            <PresetBar
              currentPreset={preset}
              onSelectPreset={(p) => setPreset(p)}
            />
          </div>

          {/* Central Stage: The Sound Reactive Orb */}
          <div className="flex-1 flex flex-col items-center justify-center w-full my-auto py-2">
            <AudioOrb
              state={agentState}
              preset={preset}
              settings={settings}
              isDark={isDark}
              onOrbClick={handleOrbClick}
              statusText={statusText}
            />

            {/* Quick Prompt Starters (Only when conversation is fresh) */}
            {messages.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-w-lg px-2">
                <button
                  onClick={() =>
                    handleSendPrompt(
                      'Analyze system status and summarize core operational capabilities.',
                      []
                    )
                  }
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-800 transition-colors"
                >
                  Analyze system status
                </button>
                <button
                  onClick={() =>
                    handleSendPrompt(
                      'Explain sound visualization frequencies and how harmonics deform the orb.',
                      []
                    )
                  }
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-800 transition-colors"
                >
                  Explain frequency harmonics
                </button>
                {!showTranscript && (
                  <button
                    onClick={() => setShowTranscript(true)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3 h-3 text-sky-400" />
                    <span>Show Transcript</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Floating Prompt & File Upload Area */}
          <div className="w-full mt-auto pt-1">
            <PromptBar
              onSubmit={handleSendPrompt}
              disabled={isProcessing}
              isListening={isListening}
              onToggleMic={handleToggleMic}
              autoSpeak={settings.autoSpeak}
              onToggleAutoSpeak={() =>
                setSettings((prev) => ({ ...prev, autoSpeak: !prev.autoSpeak }))
              }
              isProcessing={isProcessing}
            />
          </div>
        </section>

        {/* Right Section: Live Transcript Pane (Always present on right side, with option to hide) */}
        {showTranscript ? (
          <LiveTranscriptPane
            isVisible={showTranscript}
            onToggleHide={() => setShowTranscript(false)}
            messages={messages}
            onClearHistory={() => setMessages([])}
            onReplayAudio={handleReplayAudio}
            onSynthesizeSpeech={handleSynthesizeSpeech}
            agentState={agentState}
          />
        ) : (
          /* Subtle toggle button to restore transcript when hidden */
          <div className="hidden lg:flex items-center">
            <button
              onClick={() => setShowTranscript(true)}
              title="Open Live Transcript"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all [writing-mode:vertical-rl] rotate-180 text-xs font-mono tracking-wider uppercase"
            >
              <PanelRightOpen className="w-4 h-4 rotate-180" />
              <span>Show Live Transcript</span>
            </button>
          </div>
        )}
      </main>

      {/* Customization Modal */}
      <CustomizationModal
        isOpen={activeTab === 'settings'}
        onClose={() => setActiveTab('agent')}
        settings={settings}
        onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
        onResetSettings={() => setSettings(DEFAULT_SETTINGS)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onTestVoice={handleTestVoice}
        isTestingVoice={isTestingVoice}
      />
    </div>
  );
}
