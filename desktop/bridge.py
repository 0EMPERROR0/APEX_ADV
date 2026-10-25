"""
A.P.E.X Desktop Bridge
Qt WebChannel communication bridge between Python backend and React frontend.
"""

import json
import logging
from typing import Optional
from PySide6.QtCore import QObject, Slot, Signal, QThread
from .agent_service import ApexAgentService

logger = logging.getLogger("ApexBridge")


class AgentWorkerThread(QThread):
    finished = Signal(dict)
    error = Signal(str)

    def __init__(self, service: ApexAgentService, messages: list, system_instruction: str, temperature: float):
        super().__init__()
        self.service = service
        self.messages = messages
        self.system_instruction = system_instruction
        self.temperature = temperature
        self._is_aborted = False

    def run(self):
        try:
            if self._is_aborted:
                return
            result = self.service.generate_chat_response(
                messages=self.messages,
                system_instruction=self.system_instruction,
                temperature=self.temperature,
            )
            if not self._is_aborted:
                self.finished.emit(result)
        except Exception as e:
            if not self._is_aborted:
                self.error.emit(str(e))

    def abort(self):
        self._is_aborted = True


class ApexBridge(QObject):
    """
    Exposed to JavaScript via Qt WebChannel as 'apexBridge'.
    """

    # Signals emitted from Python to React
    stateChanged = Signal(str)          # 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
    transcriptUpdated = Signal(str)     # JSON string of transcript item
    responseReceived = Signal(str)      # JSON string of agent message
    audioPlaybackReady = Signal(str)    # base64 audio data
    errorOccurred = Signal(str)         # error message string
    settingsLoaded = Signal(str)        # JSON string of settings

    def __init__(self, service: Optional[ApexAgentService] = None, parent=None):
        super().__init__(parent)
        self.service = service or ApexAgentService()
        self.current_worker: Optional[AgentWorkerThread] = None
        self._saved_settings = {
            "voice": "Kore",
            "systemPersona": "minimalist",
            "customPrompt": "",
            "temperature": 0.7,
            "sensitivity": 1.1,
            "gain": 1.3,
            "autoSpeak": True,
            "noiseSuppression": True,
        }

    # =========================================================================
    # Slots callable from JavaScript
    # =========================================================================

    @Slot(str)
    def sendMessage(self, payload_json: str):
        """
        Receives message request from React frontend and executes in background thread.
        Payload format:
        {
            "messages": [...],
            "systemInstruction": "...",
            "temperature": 0.7
        }
        """
        try:
            data = json.loads(payload_json)
            messages = data.get("messages", [])
            system_instruction = data.get("systemInstruction", "")
            temperature = float(data.get("temperature", 0.7))

            self.stateChanged.emit("thinking")

            if self.current_worker and self.current_worker.isRunning():
                self.current_worker.abort()
                self.current_worker.wait(500)

            self.current_worker = AgentWorkerThread(
                self.service, messages, system_instruction, temperature
            )
            self.current_worker.finished.connect(self._on_worker_finished)
            self.current_worker.error.connect(self._on_worker_error)
            self.current_worker.start()

        except Exception as e:
            logger.error(f"Error in sendMessage: {e}")
            self.stateChanged.emit("error")
            self.errorOccurred.emit(str(e))

    def _on_worker_finished(self, result: dict):
        if "error" in result:
            self.stateChanged.emit("error")
            self.errorOccurred.emit(result["error"])
        else:
            text = result.get("text", "")
            self.responseReceived.emit(json.dumps({"text": text}))
            self.stateChanged.emit("idle")

    def _on_worker_error(self, err_msg: str):
        self.stateChanged.emit("error")
        self.errorOccurred.emit(err_msg)

    @Slot(str, str)
    def synthesizeSpeech(self, text: str, voice: str):
        """
        Requests TTS audio synthesis from Python.
        """
        try:
            self.stateChanged.emit("speaking")
            res = self.service.synthesize_speech(text, voice)
            if "audio" in res:
                self.audioPlaybackReady.emit(res["audio"])
            else:
                self.stateChanged.emit("idle")
                if "error" in res:
                    self.errorOccurred.emit(res["error"])
        except Exception as e:
            logger.error(f"Error in synthesizeSpeech: {e}")
            self.stateChanged.emit("idle")
            self.errorOccurred.emit(str(e))

    @Slot()
    def startVoiceSession(self):
        """Starts voice listening state."""
        logger.info("Voice session initiated from bridge.")
        self.stateChanged.emit("listening")

    @Slot()
    def stopVoiceSession(self):
        """Stops voice session."""
        logger.info("Voice session terminated from bridge.")
        self.stateChanged.emit("idle")

    @Slot()
    def emergencyStop(self):
        """Emergency stop: immediately halts active generation and audio."""
        logger.info("Emergency stop triggered.")
        if self.current_worker and self.current_worker.isRunning():
            self.current_worker.abort()
            self.current_worker.wait(300)
        self.stateChanged.emit("idle")

    @Slot(result=str)
    def getSettings(self) -> str:
        """Returns persisted settings as JSON."""
        return json.dumps(self._saved_settings)

    @Slot(str)
    def saveSettings(self, settings_json: str):
        """Persists settings."""
        try:
            data = json.loads(settings_json)
            self._saved_settings.update(data)
            logger.info("Settings updated via bridge.")
        except Exception as e:
            logger.error(f"Error saving settings: {e}")

    @Slot(result=str)
    def ping(self) -> str:
        """Health check slot."""
        return "pong"
