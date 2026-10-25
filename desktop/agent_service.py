"""
A.P.E.X Desktop Agent Service
Manages AI interactions, multimodal processing, and voice synthesis securely on the Python side.
"""

import os
import json
import base64
import logging
from typing import Dict, Any, List, Optional
import urllib.request
import urllib.error

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")
logger = logging.getLogger("ApexAgentService")

class ApexAgentService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.models = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]
        self.tts_model = "gemini-3.8-flash-lite-tts"

    def set_api_key(self, key: str):
        self.api_key = key.strip()

    def has_api_key(self) -> bool:
        return bool(self.api_key)

    def generate_chat_response(
        self,
        messages: List[Dict[str, Any]],
        system_instruction: str = "",
        temperature: float = 0.7,
    ) -> Dict[str, Any]:
        """
        Generates agent response using Google Gemini API directly from Python.
        Supports multimodal parts: text and inline base64 files.
        """
        if not self.has_api_key():
            return {
                "error": "GEMINI_API_KEY is not set. Please configure it in your .env or environment variables."
            }

        # Build contents array
        formatted_contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            parts = []

            # Attached files
            files = msg.get("files", [])
            for f in files:
                raw_b64 = f.get("base64", "")
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                parts.append({
                    "inline_data": {
                        "mime_type": f.get("type", "application/octet-stream"),
                        "data": raw_b64,
                    }
                })

            # Text content
            content_text = msg.get("content", "")
            if content_text:
                parts.append({"text": content_text})

            if not parts:
                parts.append({"text": "..."})

            formatted_contents.append({"role": role, "parts": parts})

        default_system = (
            "You are A.P.E.X, a state-of-the-art multimodal AI agent operating in a native Windows desktop environment.\n"
            "Communicate with supreme clarity, precision, and architectural elegance.\n"
            "When responding:\n"
            "- Be incisive, insightful, and comprehensive without fluff.\n"
            "- Use clean formatting, bullet points, and code blocks with language tags when relevant."
        )

        payload = {
            "contents": formatted_contents,
            "generationConfig": {
                "temperature": temperature,
            },
        }

        if system_instruction or default_system:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction or default_system}]
            }

        payload_bytes = json.dumps(payload).encode("utf-8")

        # Try models in order for resilience
        last_error = None
        for model in self.models:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
            req = urllib.request.Request(
                endpoint,
                data=payload_bytes,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "APEX-ADV-Desktop/1.0",
                },
                method="POST",
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    text = ""
                    candidates = resp_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = "".join(p.get("text", "") for p in parts)
                    return {"text": text, "model": model}
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8")
                logger.warning(f"Model {model} failed with HTTP {e.code}: {err_body}")
                last_error = f"HTTP {e.code}: {err_body}"
                if e.code == 503:
                    # Model at capacity, fallback to next
                    continue
                else:
                    return {"error": last_error}
            except Exception as e:
                logger.error(f"Error calling {model}: {e}")
                last_error = str(e)

        return {"error": last_error or "Failed to connect to Gemini API."}

    def synthesize_speech(self, text: str, voice: str = "Kore") -> Dict[str, Any]:
        """
        Synthesizes speech using Gemini TTS and returns base64 WAV audio.
        """
        if not self.has_api_key():
            return {"error": "GEMINI_API_KEY is missing."}

        clean_text = text.replace("```", "").strip()[:400]
        if not clean_text:
            return {"error": "Text is empty."}

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": clean_text}],
                }
            ],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice or "Kore"}
                    }
                },
            },
        }

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.tts_model}:generateContent?key={self.api_key}"
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "APEX-ADV-Desktop/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                candidates = resp_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    for part in parts:
                        inline = part.get("inlineData", {})
                        if inline.get("data"):
                            return {"audio": inline.get("data"), "mimeType": "audio/wav"}
                return {"error": "No audio returned in candidates."}
        except Exception as e:
            logger.warning(f"TTS synthesis error: {e}")
            return {"error": str(e)}
