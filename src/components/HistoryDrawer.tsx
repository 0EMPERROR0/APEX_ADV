import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AgentState } from '../types/agent';
import { ChevronRight, Copy, Check, Volume2, FileText, Trash2, PanelRightClose, Sparkles } from 'lucide-react';

interface LiveTranscriptProps {
  isVisible: boolean;
  onToggleHide: () => void;
  messages: ChatMessage[];
  onClearHistory: () => void;
  onReplayAudio: (base64Audio: string) => void;
  onSynthesizeSpeech?: (text: string) => void;
  agentState: AgentState;
}

export const LiveTranscriptPane: React.FC<LiveTranscriptProps> = ({
  isVisible,
  onToggleHide,
  messages,
  onClearHistory,
  onReplayAudio,
  onSynthesizeSpeech,
  agentState,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentState]);

  if (!isVisible) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-full lg:w-[420px] xl:w-[460px] h-[500px] lg:h-[calc(100vh-6.5rem)] flex flex-col rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden transition-all duration-300 shrink-0">
      {/* Transcript Header */}
      <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
            Live Transcript
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            ({messages.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={onClearHistory}
              title="Clear transcript"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Hide button */}
          <button
            onClick={onToggleHide}
            title="Hide Live Transcript"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Hide</span>
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Live Transcript Ready
            </p>
            <p className="text-[11px] max-w-xs text-slate-500">
              Speak or send a prompt below. A.P.E.X speech and responses will transcribe here in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                  <span className="font-mono font-medium">
                    {isUser ? 'User' : 'A.P.E.X'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{formatTime(msg.timestamp)}</span>
                </div>

                {/* Attached Files Chips */}
                {msg.files && msg.files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1 max-w-[90%]">
                    {msg.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        <FileText className="w-3 h-3 text-sky-400" />
                        <span className="truncate max-w-[110px]">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`relative group rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed max-w-[95%] whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 rounded-tr-sm'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 rounded-tl-sm'
                  }`}
                >
                  {msg.content}

                  {/* Actions on hover */}
                  <div className="mt-2 pt-1 border-t border-slate-200/40 dark:border-slate-700/40 flex items-center justify-end gap-2 text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">
                    {!isUser && msg.audioBase64 && (
                      <button
                        onClick={() => onReplayAudio(msg.audioBase64!)}
                        className="flex items-center gap-1 hover:text-sky-500 dark:hover:text-sky-300"
                        title="Replay Voice Audio"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Replay</span>
                      </button>
                    )}
                    {!isUser && onSynthesizeSpeech && (
                      <button
                        onClick={() => onSynthesizeSpeech(msg.content)}
                        className="flex items-center gap-1 hover:text-sky-500 dark:hover:text-sky-300"
                        title="Vocalize this text"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Speak</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center gap-1 hover:text-sky-500 dark:hover:text-sky-300"
                      title="Copy text"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Live typing/synthesizing indicator */}
        {agentState === 'thinking' && (
          <div className="flex items-center gap-2 text-xs text-sky-500 font-mono py-1 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
            <span>A.P.E.X is synthesizing response...</span>
          </div>
        )}
        {agentState === 'speaking' && (
          <div className="flex items-center gap-2 text-xs text-sky-400 font-mono py-1 px-1">
            <Volume2 className="w-3.5 h-3.5 animate-pulse text-sky-400" />
            <span>A.P.E.X is speaking...</span>
          </div>
        )}
      </div>
    </aside>
  );
};
