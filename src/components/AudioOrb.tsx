import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AgentState, VisualizerPreset, PRESET_CONFIGS, AgentSettings } from '../types/agent';
import { audioEngine } from '../utils/audioEngine';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';

interface AudioOrbProps {
  state: AgentState;
  preset: VisualizerPreset;
  settings: AgentSettings;
  isDark: boolean;
  onOrbClick?: () => void;
  statusText?: string;
}

export const AudioOrb: React.FC<AudioOrbProps> = ({
  state,
  preset,
  settings,
  isDark,
  onOrbClick,
  statusText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mouse tilt tracking with inertia
  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [hovered, setHovered] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({ overall: 0, low: 0, high: 0, isLive: false });

  // Persistent animation state
  const animState = useRef({
    rotation: 0,
    pulse: 1.0,
    phase: 0,
    particles: Array.from({ length: 64 }, (_, i) => ({
      angle: (i / 64) * Math.PI * 2,
      dist: 0.8 + Math.random() * 0.5,
      speed: 0.005 + Math.random() * 0.012,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.3 + Math.random() * 0.6,
      orbitOffset: Math.random() * Math.PI * 2,
    })),
    smoothedLow: 0,
    smoothedMid: 0,
    smoothedHigh: 0,
    smoothedOverall: 0,
  });

  // Handle mouse movement for 3D tilt
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    mousePos.current.targetX = x;
    mousePos.current.targetY = y;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mousePos.current.targetX = 0;
    mousePos.current.targetY = 0;
    setHovered(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const config = PRESET_CONFIGS[preset] || PRESET_CONFIGS.singularity;

    // Render loop
    const render = () => {
      // Smooth mouse interpolation
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

      // Fetch real frequency metrics
      const metrics = audioEngine.getFrequencyMetrics(settings.gain, settings.sensitivity);

      // Low-pass smoothing for audio reaction
      const state_ = animState.current;
      state_.smoothedLow += (metrics.low - state_.smoothedLow) * 0.18;
      state_.smoothedMid += (metrics.mid - state_.smoothedMid) * 0.18;
      state_.smoothedHigh += (metrics.high - state_.smoothedHigh) * 0.18;
      state_.smoothedOverall += (metrics.overall - state_.smoothedOverall) * 0.18;

      setLiveMetrics({
        overall: state_.smoothedOverall,
        low: state_.smoothedLow,
        high: state_.smoothedHigh,
        isLive: metrics.hasLiveAudio,
      });

      // Clear canvas with subtle trail
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2 + mousePos.current.x * 20;
      const centerY = height / 2 + mousePos.current.y * 20;
      const baseRadius = Math.min(width, height) * 0.22;

      // State speed multiplier
      let speedMult = 1.0;
      let stateScale = 1.0;
      if (state === 'thinking') {
        speedMult = 2.4;
        stateScale = 0.95;
      } else if (state === 'listening') {
        speedMult = 1.4;
        stateScale = 1.08;
      } else if (state === 'speaking') {
        speedMult = 2.2;
        stateScale = 1.22;
      }

      state_.rotation += 0.008 * speedMult * (1 + state_.smoothedMid * 0.8);
      state_.phase += 0.02 * speedMult;

      const dynamicRadius = Math.max(
        10,
        baseRadius * stateScale * (1 + state_.smoothedLow * (state === 'speaking' ? 0.48 : 0.28))
      );

      // ==========================================
      // Preset Specific Renderers
      // ==========================================
      switch (preset) {
        case 'singularity':
          renderSingularity(ctx, centerX, centerY, dynamicRadius, state_, config, isDark, state);
          break;
        case 'quantum_aurora':
          renderQuantumAurora(ctx, centerX, centerY, dynamicRadius, state_, config, isDark, state);
          break;
        case 'neural_pulse':
          renderNeuralPulse(ctx, centerX, centerY, dynamicRadius, state_, config, isDark, state);
          break;
        case 'cyber_wire':
          renderCyberWire(ctx, centerX, centerY, dynamicRadius, state_, config, isDark, state);
          break;
        case 'harmonic_eclipse':
          renderHarmonicEclipse(ctx, centerX, centerY, dynamicRadius, state_, config, isDark, state);
          break;
      }

      // Vocal Speech Harmonic Ripples (Active when speaking)
      if (state === 'speaking') {
        const rippleCount = 3;
        for (let rIdx = 0; rIdx < rippleCount; rIdx++) {
          const progress = ((state_.phase * 1.6 + rIdx * (1 / rippleCount)) % 1);
          const rippleRadius = dynamicRadius + progress * dynamicRadius * 0.85;
          const alpha = (1 - progress) * (0.4 + state_.smoothedOverall * 0.45);
          ctx.beginPath();
          ctx.arc(centerX, centerY, Math.max(0.1, rippleRadius), 0, Math.PI * 2);
          ctx.strokeStyle = config.colors.secondary;
          ctx.lineWidth = 1.8 + (1 - progress) * 2.2;
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [preset, state, settings.gain, settings.sensitivity, isDark]);

  // ==========================================
  // RENDERER 1: SINGULARITY CORE
  // ==========================================
  const renderSingularity = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    st: any,
    cfg: any,
    dark: boolean,
    agentState: AgentState
  ) => {
    // 1. Exterior Atmospheric Glow
    const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.4);
    auraGrad.addColorStop(0, cfg.colors.glow);
    auraGrad.addColorStop(0.5, dark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.05)');
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Accretion Disk / Orbital Rings
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(st.rotation * (i % 2 === 0 ? 1 : -1) + (i * Math.PI) / 3);
      ctx.beginPath();
      const ringRx = Math.max(0.1, Math.abs(r * (1.35 + i * 0.35 + st.smoothedMid * 0.2)));
      const ringRy = Math.max(0.1, Math.abs(ringRx * 0.32));
      ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === 0 ? cfg.colors.secondary : cfg.colors.accent;
      ctx.lineWidth = 1.2 + st.smoothedHigh * 2;
      ctx.globalAlpha = 0.45 + st.smoothedOverall * 0.4;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Central Dark Matter Sphere
    const coreGrad = ctx.createRadialGradient(
      cx - r * 0.25 + mousePos.current.x * 15,
      cy - r * 0.25 + mousePos.current.y * 15,
      r * 0.05,
      cx,
      cy,
      r
    );
    if (dark) {
      coreGrad.addColorStop(0, '#1e293b');
      coreGrad.addColorStop(0.6, '#0f172a');
      coreGrad.addColorStop(0.92, '#020617');
      coreGrad.addColorStop(1, cfg.colors.secondary);
    } else {
      coreGrad.addColorStop(0, '#f8fafc');
      coreGrad.addColorStop(0.7, '#e2e8f0');
      coreGrad.addColorStop(0.95, '#0f172a');
      coreGrad.addColorStop(1, cfg.colors.secondary);
    }

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 4. Luminous Rim Highlight (Event Horizon)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = cfg.colors.secondary;
    ctx.lineWidth = 2.5 + st.smoothedLow * 3;
    ctx.shadowColor = cfg.colors.secondary;
    ctx.shadowBlur = 24 + st.smoothedHigh * 30;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // 5. Floating Relativistic Particles
    st.particles.forEach((p: any) => {
      p.angle += p.speed * (1 + st.smoothedHigh * 3);
      const pr = r * (p.dist + st.smoothedLow * 0.3);
      const px = cx + Math.cos(p.angle) * pr;
      const py = cy + Math.sin(p.angle) * pr * 0.55;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = cfg.colors.secondary;
      ctx.globalAlpha = p.alpha * (0.5 + st.smoothedOverall * 0.5);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  };

  // ==========================================
  // RENDERER 2: QUANTUM AURORA
  // ==========================================
  const renderQuantumAurora = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    st: any,
    cfg: any,
    dark: boolean,
    agentState: AgentState
  ) => {
    // Multi-harmonic fluid ribbon waves
    const layers = 5;
    for (let l = 0; l < layers; l++) {
      ctx.save();
      ctx.beginPath();
      const points = 36;
      for (let i = 0; i <= points; i++) {
        const theta = (i / points) * Math.PI * 2;
        const wave1 = Math.sin(theta * 3 + st.phase * 2 + l) * (r * 0.12 * (1 + st.smoothedMid));
        const wave2 = Math.cos(theta * 5 - st.phase * 1.5) * (r * 0.08 * (1 + st.smoothedLow));
        const currentR = r * (0.75 + l * 0.12) + wave1 + wave2;

        const x = cx + Math.cos(theta) * currentR;
        const y = cy + Math.sin(theta) * currentR;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const alpha = (0.2 + (layers - l) * 0.12) * (0.6 + st.smoothedOverall * 0.6);
      ctx.strokeStyle = l % 2 === 0 ? cfg.colors.secondary : cfg.colors.accent;
      ctx.lineWidth = 2.0;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = cfg.colors.secondary;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.restore();
    }

    // Radiant fluid core
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.9);
    coreGrad.addColorStop(0, dark ? 'rgba(45, 212, 191, 0.9)' : 'rgba(13, 148, 136, 0.85)');
    coreGrad.addColorStop(0.5, dark ? 'rgba(168, 85, 247, 0.45)' : 'rgba(147, 51, 234, 0.3)');
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  };

  // ==========================================
  // RENDERER 3: NEURAL PULSE
  // ==========================================
  const renderNeuralPulse = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    st: any,
    cfg: any,
    dark: boolean,
    agentState: AgentState
  ) => {
    const nodeCount = 20;
    const nodes: Array<{ x: number; y: number; size: number }> = [];

    // Calculate node coordinates on a pulsating neural lattice
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2 + st.rotation * 0.5;
      const dist = r * (0.45 + ((i % 4) * 0.18) + st.smoothedLow * 0.25);
      const wobble = Math.sin(st.phase * 3 + i) * (r * 0.08);
      const nx = cx + Math.cos(angle) * (dist + wobble);
      const ny = cy + Math.sin(angle) * (dist + wobble);
      nodes.push({ x: nx, y: ny, size: 2.5 + (i % 3) * 1.5 });
    }

    // Connect synapses
    ctx.lineWidth = 1;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r * 0.85) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          const strength = (1 - dist / (r * 0.85)) * (0.3 + st.smoothedOverall * 0.7);
          ctx.strokeStyle = j % 2 === 0 ? cfg.colors.secondary : cfg.colors.accent;
          ctx.globalAlpha = strength;
          ctx.stroke();
        }
      }
    }

    // Draw active synaptic nodes
    nodes.forEach((n, idx) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.size * (1 + st.smoothedHigh * 1.5), 0, Math.PI * 2);
      ctx.fillStyle = idx % 2 === 0 ? cfg.colors.secondary : cfg.colors.accent;
      ctx.globalAlpha = 0.85 + st.smoothedMid * 0.15;
      ctx.shadowColor = cfg.colors.secondary;
      ctx.shadowBlur = 10;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Central pulsing cerebral nucleus
    const nucleusGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.4);
    nucleusGrad.addColorStop(0, cfg.colors.secondary);
    nucleusGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nucleusGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.4 * (1 + st.smoothedLow * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  };

  // ==========================================
  // RENDERER 4: CYBER GEODESIC WIREFRAME
  // ==========================================
  const renderCyberWire = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    st: any,
    cfg: any,
    dark: boolean,
    agentState: AgentState
  ) => {
    const latLines = 8;
    const lonLines = 12;

    ctx.save();
    ctx.translate(cx, cy);

    // Rotating 3D wireframe projections
    for (let lat = 1; lat < latLines; lat++) {
      const phi = (lat / latLines) * Math.PI;
      const ringR = Math.max(0.1, Math.abs(Math.sin(phi) * r * (1 + st.smoothedLow * 0.18)));
      const ringZ = Math.cos(phi) * r;

      ctx.beginPath();
      const tilt = mousePos.current.y * 0.4;
      ctx.ellipse(0, ringZ * Math.cos(tilt), ringR, Math.max(0.1, ringR * 0.35), 0, 0, Math.PI * 2);
      ctx.strokeStyle = cfg.colors.secondary;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4 + st.smoothedMid * 0.5;
      ctx.stroke();
    }

    for (let lon = 0; lon < lonLines; lon++) {
      const theta = (lon / lonLines) * Math.PI + st.rotation;
      const lonRadiusX = Math.max(0.1, Math.abs(r * Math.sin(theta) * (1 + st.smoothedHigh * 0.15)));
      const lonRadiusY = Math.max(0.1, r);
      ctx.beginPath();
      ctx.ellipse(0, 0, lonRadiusX, lonRadiusY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = cfg.colors.accent;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.35 + st.smoothedHigh * 0.45;
      ctx.stroke();
    }

    // Outer Geodesic boundary
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.strokeStyle = cfg.colors.secondary;
    ctx.lineWidth = 2;
    ctx.shadowColor = cfg.colors.secondary;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1.0;
  };

  // ==========================================
  // RENDERER 5: HARMONIC ECLIPSE
  // ==========================================
  const renderHarmonicEclipse = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    st: any,
    cfg: any,
    dark: boolean,
    agentState: AgentState
  ) => {
    // Coronal solar flares radiating outwards
    const rays = 48;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 + st.phase * 0.4;
      const rayLen = r * (1.1 + Math.sin(i * 3 + st.phase * 4) * 0.35 * (1 + st.smoothedMid * 1.5));
      const rx = cx + Math.cos(angle) * rayLen;
      const ry = cy + Math.sin(angle) * rayLen;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.lineTo(rx, ry);
      ctx.strokeStyle = i % 2 === 0 ? cfg.colors.secondary : cfg.colors.accent;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.35 + st.smoothedOverall * 0.5;
      ctx.stroke();
    }

    // Massive luminous golden halo
    const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.8);
    haloGrad.addColorStop(0, cfg.colors.secondary);
    haloGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.2)');
    haloGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Monolithic Obsidian Eclipse Core
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#0a0a0c' : '#18181b';
    ctx.fill();
    ctx.strokeStyle = cfg.colors.secondary;
    ctx.lineWidth = 3;
    ctx.shadowColor = cfg.colors.secondary;
    ctx.shadowBlur = 25;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  };

  const currentConfig = PRESET_CONFIGS[preset] || PRESET_CONFIGS.singularity;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setHovered(true)}
      onClick={onOrbClick}
      className="relative flex flex-col items-center justify-center w-full max-w-xl mx-auto h-[380px] sm:h-[440px] cursor-pointer select-none group"
      aria-label="Interactive Reactive Sound Orb"
    >
      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Subtle State Cue Pill */}
      <div className="absolute bottom-4 sm:bottom-6 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-md border border-slate-700/40 dark:border-slate-800/60 transition-all duration-300 group-hover:border-slate-600/70">
        <span
          className="w-2 h-2 rounded-full transition-colors duration-300"
          style={{
            backgroundColor:
              state === 'listening'
                ? '#10b981'
                : state === 'thinking'
                ? '#8b5cf6'
                : state === 'speaking'
                ? '#38bdf8'
                : state === 'error'
                ? '#ef4444'
                : '#94a3b8',
            boxShadow: `0 0 10px ${
              state === 'listening'
                ? '#10b981'
                : state === 'speaking'
                ? '#38bdf8'
                : 'transparent'
            }`,
          }}
        />
        <span className="text-xs font-mono tracking-wider uppercase text-slate-300 font-medium">
          {statusText || (state === 'idle' ? 'STANDBY · TAP TO ACTIVATE' : state)}
        </span>
        {state === 'speaking' && <Volume2 className="w-3.5 h-3.5 text-sky-400 animate-pulse" />}
        {state === 'listening' && <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
      </div>

      {/* Subtle frequency audio reactive bar below orb */}
      {liveMetrics.isLive && (
        <div className="absolute bottom-0 flex items-center gap-1 opacity-70">
          <div
            className="w-1 bg-sky-400 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(4, liveMetrics.low * 18)}px` }}
          />
          <div
            className="w-1 bg-sky-300 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(4, liveMetrics.overall * 22)}px` }}
          />
          <div
            className="w-1 bg-indigo-400 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(4, liveMetrics.high * 16)}px` }}
          />
        </div>
      )}
    </div>
  );
};
