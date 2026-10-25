import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Mic, MicOff, Volume2, VolumeX, FileText, Image as ImageIcon, CornerDownLeft } from 'lucide-react';
import { ChatFile } from '../types/agent';

interface PromptBarProps {
  onSubmit: (prompt: string, files: ChatFile[]) => void;
  disabled?: boolean;
  isListening: boolean;
  onToggleMic: () => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  isProcessing?: boolean;
}

export const PromptBar: React.FC<PromptBarProps> = ({
  onSubmit,
  disabled = false,
  isListening,
  onToggleMic,
  autoSpeak,
  onToggleAutoSpeak,
  isProcessing = false,
}) => {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [prompt]);

  // Speech recognition transcription support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition: any = null;

    if (isListening) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setPrompt((prev) => {
              const base = prev.trim();
              return base ? `${base} ${currentTranscript.trim()}` : currentTranscript.trim();
            });
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition status:', e?.error);
        };

        recognition.start();
      } catch (err) {
        console.warn('Speech recognition init error:', err);
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isListening]);

  const handleFileSelection = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: ChatFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Max 20MB per file
      if (file.size > 20 * 1024 * 1024) {
        alert(`File ${file.name} exceeds the 20MB limit.`);
        continue;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      let previewUrl = '';
      if (file.type.startsWith('image/')) {
        previewUrl = base64;
      }

      newFiles.push({
        id: `${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type || 'text/plain',
        base64,
        previewUrl,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if ((!trimmed && files.length === 0) || disabled || isProcessing) return;

    onSubmit(trimmed, files);
    setPrompt('');
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-4 select-none">
      {/* File Attachment Previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm"
            >
              {file.type.startsWith('image/') ? (
                <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{file.name}</span>
              <span className="text-[10px] text-slate-400">({formatFileSize(file.size)})</span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Glass Input Container */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border transition-all duration-200 shadow-lg ${
          isDragging
            ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20'
            : 'border-slate-200 dark:border-slate-800/90 focus-within:border-slate-400 dark:focus-within:border-slate-700'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'Listening to your voice... Speak or type prompt...'
              : 'Message A.P.E.X or attach files (images, documents, code)...'
          }
          rows={1}
          disabled={disabled || isProcessing}
          className="w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none max-h-44"
        />

        {/* Action Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          {/* Left tools: File upload & Voice toggle */}
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileSelection(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload files (Images, Documents, PDFs, Code, Audio)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <Paperclip className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline text-[11px]">Upload Files</span>
            </button>

            <button
              type="button"
              onClick={onToggleMic}
              title={isListening ? 'Mute microphone' : 'Activate microphone input'}
              className={`p-2 rounded-xl transition-colors ${
                isListening
                  ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleAutoSpeak}
              title={autoSpeak ? 'Voice output: ENABLED' : 'Voice output: MUTED'}
              className={`p-2 rounded-xl transition-colors ${
                autoSpeak
                  ? 'text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40'
                  : 'text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Right tool: Send button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!prompt.trim() && files.length === 0) || disabled || isProcessing}
              className={`p-2 rounded-xl transition-all duration-150 flex items-center justify-center ${
                (prompt.trim() || files.length > 0) && !isProcessing
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
