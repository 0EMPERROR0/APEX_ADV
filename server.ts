import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// High body limit to support base64 file uploads (images, audio, documents)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini client initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

interface ChatFile {
  name: string;
  type: string;
  base64: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  files?: ChatFile[];
}

async function generateWithRetry(fn: () => Promise<any>, maxRetries = 2, delayMs = 1000): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isTransient = err?.message?.includes('503') || err?.status === 503 || err?.message?.includes('high demand');
      if (isTransient && attempt < maxRetries) {
        console.warn(`[Gemini API] Transient 503 hit, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }
}

async function generateChatWithFallback(contents: any, systemInstruction: string, temperature: number) {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature,
        },
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const isUnavailable = err?.message?.includes('503') || err?.status === 503 || err?.message?.includes('high demand');
      if (isUnavailable) {
        console.warn(`[Gemini API] Model ${model} is at capacity (503). Falling back to next available model...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

app.post('/api/agent/chat', async (req: Request, res: Response) => {
  try {
    const { messages, systemInstruction, temperature = 0.7 } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
    }

    // Format Gemini contents
    const contents = messages.map((msg: ChatMessage) => {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add attached files if present
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          const rawBase64 = file.base64.includes(',') ? file.base64.split(',')[1] : file.base64;
          parts.push({
            inlineData: {
              mimeType: file.type || 'application/octet-stream',
              data: rawBase64,
            },
          });
        }
      }

      // Add text content
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts.length > 0 ? parts : [{ text: '...' }],
      };
    });

    const defaultSystem = `You are A.P.E.X, a state-of-the-art multimodal AI agent. 
You communicate with supreme clarity, precision, and architectural elegance.
Your tone is sleek, refined, and intelligent.
When responding:
- Be incisive, insightful, and comprehensive without unnecessary fluff.
- Use clean formatting, bullet points, and code blocks with language tags when relevant.
- You can process audio transcripts, user commands, and analyzed files flawlessly.`;

    const response = await generateChatWithFallback(
      contents,
      systemInstruction || defaultSystem,
      Number(temperature) || 0.7
    );

    res.json({
      text: response.text || '',
      usage: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('Error in /api/agent/chat:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate agent response',
    });
  }
});

// Text-to-speech endpoint for the speaking reactive orb
app.post('/api/agent/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    // Sanitize and cap TTS input length for snappy vocalization (limit to ~400 characters of clean speech)
    // Strip markdown formatting symbols for natural vocal clarity
    const cleanSpeech = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/[*_#`[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const vocalText = cleanSpeech.length > 450 ? cleanSpeech.substring(0, 447) + '...' : cleanSpeech;

    const ttsResponse = await generateWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: vocalText,
                speechMetadata: {
                  style: 'Crisp, articulate, high-tech executive assistant',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
            },
          },
        },
      })
    );

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned from speech synthesis' });
    }

    res.json({
      audio: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error in /api/agent/tts:', error);
    res.status(500).json({
      error: error?.message || 'Failed to synthesize speech',
    });
  }
});

// Setup Vite middleware in dev or static server in prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[APEX ADV Server] Running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
