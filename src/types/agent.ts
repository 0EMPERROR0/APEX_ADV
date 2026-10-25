export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type VisualizerPreset = 
  | 'singularity' 
  | 'quantum_aurora' 
  | 'neural_pulse' 
  | 'cyber_wire' 
  | 'harmonic_eclipse';

export type VoiceOption = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type SystemPersona = 'minimalist' | 'architect' | 'futurist' | 'custom';

export interface ChatFile {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  files?: ChatFile[];
  timestamp: number;
  audioBase64?: string;
}

export interface AgentSettings {
  voice: VoiceOption;
  systemPersona: SystemPersona;
  customPrompt: string;
  temperature: number;
  sensitivity: number; // 0.5 - 2.5
  gain: number; // 1.0 - 3.0
  turbulence: number; // 0.2 - 2.0
  glowIntensity: number; // 0.2 - 2.0
  autoSpeak: boolean;
  noiseSuppression: boolean;
}

export interface PresetInfo {
  id: VisualizerPreset;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
}

export const PRESET_CONFIGS: Record<VisualizerPreset, PresetInfo> = {
  singularity: {
    id: 'singularity',
    name: 'Singularity Core',
    description: 'Gravitational dark-matter sphere with high-luminosity horizon flare',
    colors: {
      primary: '#0f172a',
      secondary: '#38bdf8',
      accent: '#818cf8',
      glow: 'rgba(56, 189, 248, 0.45)',
    },
  },
  quantum_aurora: {
    id: 'quantum_aurora',
    name: 'Quantum Aurora',
    description: 'Fluid undulating ribbons of emerald, cyan, and violet luminescence',
    colors: {
      primary: '#064e3b',
      secondary: '#2dd4bf',
      accent: '#a855f7',
      glow: 'rgba(45, 212, 191, 0.45)',
    },
  },
  neural_pulse: {
    id: 'neural_pulse',
    name: 'Neural Pulse',
    description: 'Synaptic particle cluster with energetic electrical impulse discharge',
    colors: {
      primary: '#311042',
      secondary: '#ec4899',
      accent: '#6366f1',
      glow: 'rgba(236, 72, 153, 0.4)',
    },
  },
  cyber_wire: {
    id: 'cyber_wire',
    name: 'Cyber Geodesic',
    description: 'Minimalist high-precision wireframe matrix with spectrum displacement',
    colors: {
      primary: '#022c22',
      secondary: '#10b981',
      accent: '#06b6d4',
      glow: 'rgba(16, 185, 129, 0.35)',
    },
  },
  harmonic_eclipse: {
    id: 'harmonic_eclipse',
    name: 'Harmonic Eclipse',
    description: 'Obsidian disc flanked by solar coronal ejections and amber resonance',
    colors: {
      primary: '#1c1917',
      secondary: '#f59e0b',
      accent: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.45)',
    },
  },
};
