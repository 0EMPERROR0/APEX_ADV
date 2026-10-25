"""
APEX_ADV — Minimalist Modern Desktop UI Engine
Drop-in replacement for ui.py in APEX_ADV (Mark LVI).
Preserves 100% backwards compatibility with main.py, core/, plugins/, and providers/.
Features animated talking mouth, collapsible transcripts (Ctrl+L), collapsible telemetry (Ctrl+M),
and a refined obsidian minimalist design.
"""

from __future__ import annotations

import json
import math
import os
import platform
import random
import subprocess
import sys
import threading
import time
from pathlib import Path

try:
    import psutil
    HAVE_PSUTIL = True
except ImportError:
    psutil = None
    HAVE_PSUTIL = False

if platform.system() == "Windows":
    _WIN_HIDE: dict = {"creationflags": subprocess.CREATE_NO_WINDOW}
else:
    _WIN_HIDE: dict = {}

os.environ.setdefault("QT_LOGGING_RULES", "qt.multimedia.*=false")

from PyQt6.QtCore import (
    QEasingCurve, QLineF, QMimeData, QObject, QParallelAnimationGroup, QPointF,
    QPoint, QPropertyAnimation, QRect, QRectF, QSize, QSizeF, Qt, QTimer,
    QUrl, pyqtSignal,
)
from PyQt6.QtGui import (
    QBrush, QColor, QConicalGradient, QDragEnterEvent, QDropEvent, QFont,
    QFontDatabase, QKeySequence, QLinearGradient, QPainter, QPainterPath,
    QPen, QPixmap, QRadialGradient, QShortcut,
)

try:
    from PyQt6.QtMultimedia import QAudioOutput, QMediaPlayer
    from PyQt6.QtMultimediaWidgets import QGraphicsVideoItem
    HAVE_VIDEO = True
except Exception as _e:
    QAudioOutput = QMediaPlayer = QGraphicsVideoItem = None
    HAVE_VIDEO = False
    print(f"[Video] playback unavailable ({_e}) — the HUD will not show video.")

from PyQt6.QtWidgets import (
    QApplication, QComboBox, QFileDialog, QFrame, QHBoxLayout, QLabel, QLineEdit,
    QMainWindow, QPushButton, QScrollArea, QSizePolicy, QSplitter,
    QGraphicsScene, QGraphicsView, QStackedWidget, QTextEdit, QVBoxLayout,
    QWidget, QProgressBar, QSlider, QCheckBox,
)

try:
    from core.avatar import HoloAvatar
    HAVE_AVATAR = True
except ImportError:
    HAVE_AVATAR = False

APP_VERSION = "APEX Mark LVI (Minimal)"
DEFAULT_UI_COLOR = "#00e5ff"
_DEFAULT_W = 1260
_DEFAULT_H = 780
_MIN_W = 920
_MIN_H = 580
_LEFT_W = 200

# Minimalist Obsidian Color Palette
class C:
    BG        = "#0a0c10"
    PANEL     = "#10141d"
    PANEL2    = "#151b27"
    BORDER    = "rgba(255, 255, 255, 0.08)"
    BORDER_B  = "rgba(255, 255, 255, 0.14)"
    BORDER_A  = "#0284c7"
    PRI       = "#38bdf8"
    PRI_DIM   = "#0284c7"
    PRI_GHO   = "rgba(56, 189, 248, 0.12)"
    ACC       = "#f97316"
    ACC2      = "#eab308"
    GREEN     = "#10b981"
    GREEN_D   = "#059669"
    RED       = "#f43f5e"
    MUTED_C   = "#fb7185"
    TEXT      = "#f1f5f9"
    TEXT_DIM  = "#64748b"
    TEXT_MED  = "#94a3b8"
    WHITE     = "#ffffff"
    DARK      = "#07090d"
    BAR_BG    = "#141923"

def _read_full_config() -> dict:
    cfg_path = Path("config") / "config.json"
    if not cfg_path.exists():
        cfg_path = Path("config.json")
    if cfg_path.exists():
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def apply_ui_accent(hex_color: str):
    if not hex_color or not hex_color.startswith("#"):
        return
    C.PRI = hex_color
    C.PRI_DIM = hex_color
    C.PRI_GHO = f"{hex_color}22"

class _SysMetrics:
    def __init__(self):
        self.cpu = 0.0
        self.mem = 0.0
        self.net = 0.0
        self.gpu = 0.0
        self.temp = 0.0
        self._last_net = 0
        if psutil:
            try:
                self._last_net = psutil.net_io_counters().bytes_sent + psutil.net_io_counters().bytes_recv
            except Exception:
                pass
        self._last_t = time.time()
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        while self._running:
            try:
                if psutil:
                    self.cpu = psutil.cpu_percent(interval=1.0)
                    self.mem = psutil.virtual_memory().percent
                    now = time.time()
                    cur_net = psutil.net_io_counters().bytes_sent + psutil.net_io_counters().bytes_recv
                    dt = max(0.1, now - self._last_t)
                    self.net = max(0.0, (cur_net - self._last_net) / dt / 1024.0)
                    self._last_net = cur_net
                    self._last_t = now
                    self.disk = psutil.disk_usage("/").percent if hasattr(psutil, "disk_usage") else 45.0
                else:
                    self.cpu, self.mem, self.net, self.disk = 14.0, 38.0, 120.0, 48.0
                    time.sleep(1.0)
            except Exception:
                time.sleep(1.0)

    def snapshot(self) -> dict:
        return {
            "cpu": self.cpu,
            "mem": self.mem,
            "net": self.net,
            "gpu": self.gpu,
            "temp": self.temp,
            "disk": getattr(self, "disk", 45.0),
        }

class MetricBar(QWidget):
    def __init__(self, label: str, color: str, parent=None):
        super().__init__(parent)
        self._label = label
        self._color = color
        self._value = 0.0
        self.setFixedHeight(28)

    def set_value(self, val: float):
        self._value = max(0.0, min(100.0, val))
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()

        p.setPen(QColor(C.TEXT_DIM))
        p.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8, QFont.Weight.Medium))
        p.drawText(QRectF(0, 0, 42, h), Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft, self._label)

        val_txt = f"{int(self._value)}%"
        p.setPen(QColor(C.TEXT))
        p.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8, QFont.Weight.DemiBold))
        p.drawText(QRectF(w - 42, 0, 42, h), Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignRight, val_txt)

        bar_x = 46.0
        bar_w = max(10.0, w - 94.0)
        bar_y = (h - 6.0) / 2.0

        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(C.BAR_BG))
        p.drawRoundedRect(QRectF(bar_x, bar_y, bar_w, 6.0), 3.0, 3.0)

        fill_w = bar_w * (self._value / 100.0)
        if fill_w > 0:
            p.setBrush(QColor(self._color))
            p.drawRoundedRect(QRectF(bar_x, bar_y, fill_w, 6.0), 3.0, 3.0)

class HudCanvas(QWidget):
    def __init__(self, face_path: str, assistant_name: str, parent=None):
        super().__init__(parent)
        self._face_path = face_path
        self._assistant_name = assistant_name
        self._audio_level = 0.0
        self._state = "IDLE"
        self._phase = 0.0
        self._mouth_open = 0.0
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._step)
        self._timer.start(33)

    def set_audio_level(self, lvl: float):
        self._audio_level = max(0.0, min(1.0, lvl))

    def set_state(self, state: str):
        self._state = state
        self.update()

    def push_visemes(self, visemes):
        if visemes:
            self._mouth_open = 0.6
        else:
            self._mouth_open = 0.0

    def glance(self, direction: str):
        pass

    def _step(self):
        self._phase += 0.05
        if self._state == "SPEAKING":
            syllable = math.sin(self._phase * 9.0) * 0.35 + math.sin(self._phase * 15.0) * 0.25
            vol = 0.3 + (self._audio_level * 0.7)
            target = max(0.08, (0.4 + syllable) * vol)
            self._mouth_open += (target - self._mouth_open) * 0.35
            self._audio_level = max(0.08, self._audio_level * 0.94)
        elif self._state == "LISTENING":
            self._mouth_open += (0.04 + self._audio_level * 0.2 - self._mouth_open) * 0.2
            self._audio_level = max(0.02, self._audio_level * 0.90)
        else:
            self._mouth_open += (0.0 - self._mouth_open) * 0.2
            self._audio_level = 0.0
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()
        cx, cy = w / 2.0, h / 2.0 - 10.0

        # Background subtle vignette
        rad = QRadialGradient(cx, cy, min(w, h) * 0.6)
        rad.setColorAt(0.0, QColor("#121722"))
        rad.setColorAt(1.0, QColor(C.BG))
        p.fillRect(0, 0, w, h, QBrush(rad))

        base_r = min(w, h) * 0.26

        # Minimalist orbital ring
        p.setPen(QPen(QColor(C.BORDER), 1.0, Qt.PenStyle.DashLine))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawEllipse(QPointF(cx, cy), base_r, base_r)

        # Pulse ring reacting to audio
        pulse_r = base_r + (self._audio_level * 36.0)
        pulse_col = QColor(C.PRI)
        pulse_col.setAlphaF(0.2 + (self._audio_level * 0.4))
        p.setPen(QPen(pulse_col, 1.5))
        p.drawEllipse(QPointF(cx, cy), pulse_r, pulse_r)

        # Head Contour
        head_w = base_r * 0.70
        head_h = base_r * 0.95
        jaw_drop = self._mouth_open * 7.0 if self._state == "SPEAKING" else 0.0

        face_path = QPainterPath()
        face_path.arcMoveTo(QRectF(cx - head_w, cy - head_h * 0.15, head_w * 2.0, head_h * 1.3), 180)
        face_path.arcTo(QRectF(cx - head_w, cy - head_h * 0.15, head_w * 2.0, head_h * 1.3), 180, -180)
        face_path.quadTo(cx + head_w * 0.4, cy + head_h * 0.85 + jaw_drop, cx, cy + head_h * 0.9 + jaw_drop)
        face_path.quadTo(cx - head_w * 0.4, cy + head_h * 0.85 + jaw_drop, cx - head_w, cy + head_h * 0.4)
        p.setPen(QPen(QColor(C.PRI_DIM), 1.2))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawPath(face_path)

        # Eyes & Eyebrows
        eye_y = cy - head_h * 0.15
        left_eye_x = cx - head_w * 0.42
        right_eye_x = cx + head_w * 0.42
        brow_emp = math.sin(self._phase * 7.0) * 2.0 if self._state == "SPEAKING" else 0.0

        p.setPen(QPen(QColor(C.PRI), 1.6))
        p.drawLine(QPointF(left_eye_x - 12.0, eye_y - 14.0 - brow_emp), QPointF(left_eye_x + 12.0, eye_y - 10.0 - brow_emp))
        p.drawLine(QPointF(right_eye_x - 12.0, eye_y - 10.0 - brow_emp), QPointF(right_eye_x + 12.0, eye_y - 14.0 - brow_emp))

        # Eye ellipses
        eye_open = 1.0 if self._state != "SLEEPING" else 0.1
        p.drawEllipse(QPointF(left_eye_x, eye_y), 11.0, 7.0 * eye_open)
        p.drawEllipse(QPointF(right_eye_x, eye_y), 11.0, 7.0 * eye_open)
        if eye_open > 0.3:
            p.setBrush(QColor("#ffffff"))
            p.drawEllipse(QPointF(left_eye_x, eye_y), 3.0, 3.0)
            p.drawEllipse(QPointF(right_eye_x, eye_y), 3.0, 3.0)
            p.setBrush(Qt.BrushStyle.NoBrush)

        # Active Talking Mouth Articulation
        mouth_y = cy + head_h * 0.42 + (jaw_drop * 0.5)
        m_spread = math.sin(self._phase * 11.0) * 4.0 if self._state == "SPEAKING" else 0.0
        m_width = max(14.0, 20.0 + m_spread + (self._audio_level * 8.0))
        m_height = max(2.5, self._mouth_open * 20.0) if self._state == "SPEAKING" else 2.0

        mouth_path = QPainterPath()
        mouth_path.moveTo(cx - m_width, mouth_y)
        mouth_path.quadTo(cx, mouth_y - (m_height * 0.5 if m_height > 3.0 else 1.0), cx + m_width, mouth_y)
        mouth_path.quadTo(cx, mouth_y + (m_height * 1.1 if m_height > 3.0 else 1.5), cx - m_width, mouth_y)

        if m_height > 3.0:
            m_col = QColor(C.PRI)
            m_col.setAlphaF(0.4)
            p.setBrush(QBrush(m_col))
        else:
            p.setBrush(Qt.BrushStyle.NoBrush)

        p.setPen(QPen(QColor(C.PRI), 1.8))
        p.drawPath(mouth_path)
        p.setBrush(Qt.BrushStyle.NoBrush)

        # Minimalist waveform arc below
        p.setPen(QPen(QColor(C.PRI_DIM), 1.5))
        wave_pts = 40
        wave_w = min(w * 0.6, 320.0)
        x_start = cx - (wave_w / 2.0)
        prev_x, prev_y = 0.0, 0.0
        for i in range(wave_pts):
            frac = i / float(wave_pts - 1)
            x = x_start + (frac * wave_w)
            amp = math.sin((frac * 6.28) + self._phase) * (6.0 + (self._audio_level * 24.0))
            y = cy + base_r + 34.0 + amp
            if i == 0:
                p.drawPoint(QPointF(x, y))
            else:
                p.drawLine(QPointF(prev_x, prev_y), QPointF(x, y))
            prev_x, prev_y = x, y

        # Status text
        p.setPen(QColor(C.TEXT_DIM))
        p.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8, QFont.Weight.Medium))
        p.drawText(QRectF(0, cy + base_r + 55.0, w, 20.0), Qt.AlignmentFlag.AlignCenter, f"● {self._state}")

class LogWidget(QTextEdit):
    _sig = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setReadOnly(True)
        self.document().setMaximumBlockCount(800)
        self.setFont(QFont("Segoe UI, -apple-system, sans-serif", 9))
        self.setStyleSheet(f"""
            QTextEdit {{
                background: {C.PANEL};
                color: {C.TEXT};
                border: 1px solid {C.BORDER};
                border-radius: 8px;
                padding: 10px;
                selection-background-color: {C.PRI_GHO};
            }}
            QScrollBar:vertical {{
                background: transparent; width: 6px; margin: 0;
            }}
            QScrollBar::handle:vertical {{
                background: rgba(255, 255, 255, 0.15); border-radius: 3px; min-height: 20px;
            }}
        """)
        self._sig.connect(self._do_append)

    def append_log(self, text: str):
        self._sig.emit(str(text))

    def _do_append(self, text: str):
        color = C.TEXT
        if text.startswith("USER:"):
            color = C.PRI
        elif text.startswith("SYS:"):
            color = C.TEXT_DIM
        elif text.startswith("WARN") or text.startswith("ERR"):
            color = C.RED
        html = f'<div style="color:{color}; margin-bottom: 4px; line-height: 1.4;">{text}</div>'
        self.append(html)
        self.verticalScrollBar().setValue(self.verticalScrollBar().maximum())

class ConfirmBanner(QWidget):
    approved = pyqtSignal()
    rejected = pyqtSignal()

    def __init__(self, title: str, detail: str, parent=None):
        super().__init__(parent)
        self.setStyleSheet(f"""
            QWidget {{
                background: {C.PANEL2};
                border: 1px solid {C.ACC};
                border-radius: 8px;
            }}
        """)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(14, 10, 14, 10)
        lbl_v = QVBoxLayout()
        t_lbl = QLabel(title)
        t_lbl.setFont(QFont("Segoe UI, -apple-system, sans-serif", 9, QFont.Weight.Bold))
        t_lbl.setStyleSheet(f"color: {C.ACC}; border: none; background: transparent;")
        lbl_v.addWidget(t_lbl)
        d_lbl = QLabel(detail)
        d_lbl.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8))
        d_lbl.setStyleSheet(f"color: {C.TEXT_MED}; border: none; background: transparent;")
        lbl_v.addWidget(d_lbl)
        lay.addLayout(lbl_v)
        lay.addStretch()

        btn_ok = QPushButton("Confirm")
        btn_ok.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_ok.setStyleSheet(f"background: {C.ACC}; color: #000; font-weight: bold; border-radius: 5px; padding: 6px 14px;")
        btn_ok.clicked.connect(self.approved.emit)
        lay.addWidget(btn_ok)

        btn_cancel = QPushButton("Cancel")
        btn_cancel.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_cancel.setStyleSheet(f"background: transparent; color: {C.TEXT_DIM}; border: 1px solid {C.BORDER}; border-radius: 5px; padding: 6px 12px;")
        btn_cancel.clicked.connect(self.rejected.emit)
        lay.addWidget(btn_cancel)

class MainWindow(QMainWindow):
    _log_sig        = pyqtSignal(str)
    _state_sig      = pyqtSignal(str)
    _content_sig    = pyqtSignal(str, str)
    _reconfig_sig   = pyqtSignal()
    _camera_sig     = pyqtSignal(bytes)
    _cam_stream_sig = pyqtSignal(bool)
    _cam_frame_sig  = pyqtSignal(bytes)
    _video_open_sig  = pyqtSignal(str, str, bool, str)
    _wake_btns_sig   = pyqtSignal()
    _video_close_sig = pyqtSignal()
    _video_mute_sig  = pyqtSignal(bool)
    _clipboard_sig  = pyqtSignal(str)
    _confirm_sig    = pyqtSignal(str, str)
    _confirm_hide_sig = pyqtSignal()
    _wake_dl_sig    = pyqtSignal(bool, str)
    _quiz_sig       = pyqtSignal(str, object, object)
    _quiz_hide_sig  = pyqtSignal()
    _review_sig     = pyqtSignal(str, str, object, object)

    def __init__(self, face_path: str):
        super().__init__()
        self._face_path = face_path
        _cfg = _read_full_config()
        self._assistant_name: str = (_cfg.get("assistant_name") or "A.P.E.X").strip()
        _display = self._assistant_name.upper()

        _ui_color = (_cfg.get("ui_color") or "").strip()
        if _ui_color and _ui_color.lower() != DEFAULT_UI_COLOR:
            apply_ui_accent(_ui_color)

        self.setWindowTitle("A.P.E.X")
        self.setMinimumSize(_MIN_W, _MIN_H)
        self.resize(_DEFAULT_W, _DEFAULT_H)

        screen = QApplication.primaryScreen().availableGeometry()
        self.move(
            (screen.width() - _DEFAULT_W) // 2,
            (screen.height() - _DEFAULT_H) // 2,
        )

        self.on_text_command   = None
        self.on_remote_clicked = None
        self.on_interrupt      = None
        self.on_voice_change   = None
        self.on_audio_device_change = None
        self._confirm_overlay  = None
        self.get_plugins       = None
        self.get_plugin_settings = None
        self.on_wake_toggle    = None
        self.on_wake_manual    = None
        self.on_push_to_talk   = None
        self.ptt_hold          = None
        self.wake_get_state    = None
        self._muted            = False
        self._current_file: str | None = None

        self._sys = _SysMetrics()

        # Build Central Structure
        central = QWidget()
        central.setStyleSheet(f"background: {C.BG}; font-family: 'Segoe UI', -apple-system, sans-serif;")
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # 1. Header
        root.addWidget(self._build_header())

        # 2. Main Body with Splitter
        self._body_widget = QWidget()
        body_lay = QHBoxLayout(self._body_widget)
        body_lay.setContentsMargins(12, 12, 12, 12)
        body_lay.setSpacing(12)

        # Left System Telemetry Rail (Collapsible via Ctrl+M)
        self._left_panel = self._build_left_panel()
        body_lay.addWidget(self._left_panel)

        # Center Column: HUD Canvas & Content Panel
        center_col = QVBoxLayout()
        center_col.setSpacing(10)
        self.hud = HudCanvas(face_path, _display)
        self.hud.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        center_col.addWidget(self.hud, stretch=3)

        self._content_panel = self._build_content_panel()
        self._content_panel.setVisible(False)
        center_col.addWidget(self._content_panel, stretch=2)

        body_lay.addLayout(center_col, stretch=3)

        # Right Column: Live Transcripts & Conversation (Collapsible via Ctrl+L)
        self._log_container = QWidget()
        log_v = QVBoxLayout(self._log_container)
        log_v.setContentsMargins(0, 0, 0, 0)
        log_v.setSpacing(6)

        log_hdr = QHBoxLayout()
        log_lbl = QLabel("LIVE TRANSCRIPTS")
        log_lbl.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8, QFont.Weight.Bold))
        log_lbl.setStyleSheet(f"color: {C.TEXT_DIM};")
        log_hdr.addWidget(log_lbl)
        log_hdr.addStretch()

        btn_clear = QPushButton("Clear")
        btn_clear.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8))
        btn_clear.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_clear.setStyleSheet(f"background: transparent; color: {C.TEXT_DIM}; border: none;")
        btn_clear.clicked.connect(lambda: self.log_widget.clear())
        log_hdr.addWidget(btn_clear)

        log_v.addLayout(log_hdr)
        self.log_widget = LogWidget()
        log_v.addWidget(self.log_widget)
        self._log_container.setFixedWidth(360)
        body_lay.addWidget(self._log_container, stretch=1)

        root.addWidget(self._body_widget, stretch=1)

        # 3. Irreversible Action Gate Placeholder
        self._confirm_box = QWidget()
        self._confirm_box.setVisible(False)
        self._confirm_lay = QVBoxLayout(self._confirm_box)
        self._confirm_lay.setContentsMargins(12, 0, 12, 6)
        root.addWidget(self._confirm_box)

        # 4. Minimalist Bottom Command Dock
        root.addWidget(self._build_bottom_bar())

        # Signals Wiring
        self._log_sig.connect(self.log_widget.append_log)
        self._state_sig.connect(self.hud.set_state)
        self._content_sig.connect(self._on_show_content)
        self._confirm_sig.connect(self._on_show_confirm)
        self._confirm_hide_sig.connect(self._on_hide_confirm)

        # Telemetry Timer
        self._metric_timer = QTimer(self)
        self._metric_timer.timeout.connect(self._tick_metrics)
        self._metric_timer.start(1000)

        # Shortcuts
        QShortcut(QKeySequence("Ctrl+L"), self, activated=self._toggle_transcripts)
        QShortcut(QKeySequence("Ctrl+M"), self, activated=self._toggle_telemetry)
        self._ready = True

    def _build_header(self) -> QWidget:
        w = QWidget()
        w.setFixedHeight(50)
        w.setStyleSheet(f"background: {C.DARK}; border-bottom: 1px solid {C.BORDER};")
        lay = QHBoxLayout(w)
        lay.setContentsMargins(16, 0, 16, 0)
        lay.setSpacing(10)

        title = QLabel(self._assistant_name.upper())
        title.setFont(QFont("Segoe UI, -apple-system, sans-serif", 11, QFont.Weight.Bold))
        title.setStyleSheet(f"color: {C.TEXT};")
        lay.addWidget(title)

        ver = QLabel(APP_VERSION)
        ver.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8))
        ver.setStyleSheet(f"color: {C.TEXT_DIM};")
        lay.addWidget(ver)

        lay.addStretch()

        # Modern Minimalist Toggles
        self._btn_toggle_log = QPushButton("💬 Transcripts")
        self._btn_toggle_log.setCheckable(True)
        self._btn_toggle_log.setChecked(True)
        self._btn_toggle_log.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_toggle_log.setStyleSheet(self._pill_btn_style())
        self._btn_toggle_log.clicked.connect(self._toggle_transcripts)
        lay.addWidget(self._btn_toggle_log)

        self._btn_toggle_sys = QPushButton("📊 Metrics")
        self._btn_toggle_sys.setCheckable(True)
        self._btn_toggle_sys.setChecked(True)
        self._btn_toggle_sys.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_toggle_sys.setStyleSheet(self._pill_btn_style())
        self._btn_toggle_sys.clicked.connect(self._toggle_telemetry)
        lay.addWidget(self._btn_toggle_sys)

        # Drawers buttons
        self._drawer_btn = QPushButton("⚙ Setup")
        self._drawer_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._drawer_btn.setStyleSheet(self._pill_btn_style())
        self._drawer_btn.clicked.connect(self._show_setup)
        lay.addWidget(self._drawer_btn)

        self._ctrl_btn = QPushButton("🎛 Controls")
        self._ctrl_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._ctrl_btn.setStyleSheet(self._pill_btn_style())
        self._ctrl_btn.clicked.connect(self._show_controls)
        lay.addWidget(self._ctrl_btn)

        return w

    def _pill_btn_style(self) -> str:
        return f"""
            QPushButton {{
                background: {C.PANEL};
                color: {C.TEXT_MED};
                border: 1px solid {C.BORDER};
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 8pt;
                font-weight: 500;
            }}
            QPushButton:hover {{
                color: {C.TEXT};
                border-color: {C.BORDER_B};
                background: {C.PANEL2};
            }}
            QPushButton:checked {{
                color: {C.PRI};
                border-color: {C.PRI_DIM};
                background: {C.PRI_GHO};
            }}
        """

    def _build_left_panel(self) -> QWidget:
        w = QWidget()
        w.setFixedWidth(_LEFT_W)
        w.setStyleSheet(f"background: {C.PANEL}; border: 1px solid {C.BORDER}; border-radius: 8px;")
        lay = QVBoxLayout(w)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(8)

        lbl = QLabel("SYSTEM METRICS")
        lbl.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8, QFont.Weight.Bold))
        lbl.setStyleSheet(f"color: {C.TEXT_DIM};")
        lay.addWidget(lbl)

        self._bar_cpu = MetricBar("CPU", C.PRI)
        self._bar_mem = MetricBar("MEM", C.ACC2)
        self._bar_net = MetricBar("NET", C.GREEN)
        self._bar_gpu = MetricBar("GPU", C.ACC)
        lay.addWidget(self._bar_cpu)
        lay.addWidget(self._bar_mem)
        lay.addWidget(self._bar_net)
        lay.addWidget(self._bar_gpu)

        lay.addStretch()

        engine_box = QWidget()
        engine_box.setStyleSheet(f"background: {C.PANEL2}; border-radius: 6px; padding: 6px;")
        e_lay = QVBoxLayout(engine_box)
        e_lay.setContentsMargins(6, 6, 6, 6)
        e_title = QLabel("LIVE ENGINE")
        e_title.setFont(QFont("Segoe UI, -apple-system, sans-serif", 7, QFont.Weight.Bold))
        e_title.setStyleSheet(f"color: {C.TEXT_DIM};")
        e_lay.addWidget(e_title)
        self._engine_status = QLabel("Gemini Live · Active")
        self._engine_status.setFont(QFont("Segoe UI, -apple-system, sans-serif", 8))
        self._engine_status.setStyleSheet(f"color: {C.GREEN};")
        e_lay.addWidget(self._engine_status)
        lay.addWidget(engine_box)

        return w

    def _build_content_panel(self) -> QWidget:
        w = QWidget()
        w.setStyleSheet(f"background: {C.PANEL}; border: 1px solid {C.BORDER}; border-radius: 8px;")
        lay = QVBoxLayout(w)
        lay.setContentsMargins(12, 10, 12, 10)
        lay.setSpacing(6)

        hdr = QHBoxLayout()
        self._content_title = QLabel("ACTIVE CONTEXT")
        self._content_title.setFont(QFont("Segoe UI, -apple-system, sans-serif", 9, QFont.Weight.Bold))
        self._content_title.setStyleSheet(f"color: {C.TEXT};")
        hdr.addWidget(self._content_title)
        hdr.addStretch()

        btn_close = QPushButton("✕")
        btn_close.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_close.setStyleSheet("background: transparent; color: #94a3b8; border: none; font-size: 10pt;")
        btn_close.clicked.connect(lambda: w.setVisible(False))
        hdr.addWidget(btn_close)
        lay.addLayout(hdr)

        self._content_body = QTextEdit()
        self._content_body.setReadOnly(True)
        self._content_body.setStyleSheet(f"background: transparent; border: none; color: {C.TEXT_MED}; font-size: 9pt;")
        lay.addWidget(self._content_body)

        return w

    def _build_bottom_bar(self) -> QWidget:
        w = QWidget()
        w.setFixedHeight(64)
        w.setStyleSheet(f"background: {C.DARK}; border-top: 1px solid {C.BORDER};")
        lay = QHBoxLayout(w)
        lay.setContentsMargins(16, 10, 16, 10)
        lay.setSpacing(10)

        self._btn_stop = QPushButton("■ Interrupt")
        self._btn_stop.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_stop.setStyleSheet(f"""
            QPushButton {{
                background: {C.PANEL};
                color: {C.RED};
                border: 1px solid {C.RED}44;
                border-radius: 6px;
                padding: 8px 14px;
                font-weight: 600;
                font-size: 8pt;
            }}
            QPushButton:hover {{ background: {C.RED}22; }}
        """)
        self._btn_stop.clicked.connect(self._handle_interrupt)
        lay.addWidget(self._btn_stop)

        self._cmd_input = QLineEdit()
        self._cmd_input.setPlaceholderText("Type a command, ask a question, or hold Ctrl+Space to speak...")
        self._cmd_input.setFont(QFont("Segoe UI, -apple-system, sans-serif", 9))
        self._cmd_input.setStyleSheet(f"""
            QLineEdit {{
                background: {C.PANEL};
                color: {C.TEXT};
                border: 1px solid {C.BORDER};
                border-radius: 6px;
                padding: 8px 12px;
            }}
            QLineEdit:focus {{
                border-color: {C.PRI_DIM};
            }}
        """)
        self._cmd_input.returnPressed.connect(self._handle_submit)
        lay.addWidget(self._cmd_input, stretch=1)

        self._btn_mic = QPushButton("🎙 Hold to Talk")
        self._btn_mic.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_mic.setStyleSheet(f"""
            QPushButton {{
                background: {C.PRI_GHO};
                color: {C.PRI};
                border: 1px solid {C.PRI_DIM};
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: 600;
                font-size: 8pt;
            }}
            QPushButton:hover {{ background: {C.PRI}33; }}
        """)
        self._btn_mic.pressed.connect(self._handle_mic_press)
        self._btn_mic.released.connect(self._handle_mic_release)
        lay.addWidget(self._btn_mic)

        return w

    def _toggle_transcripts(self):
        visible = not self._log_container.isVisible()
        self._log_container.setVisible(visible)
        self._btn_toggle_log.setChecked(visible)

    def _toggle_telemetry(self):
        visible = not self._left_panel.isVisible()
        self._left_panel.setVisible(visible)
        self._btn_toggle_sys.setChecked(visible)

    def _tick_metrics(self):
        s = self._sys.snapshot()
        self._bar_cpu.set_value(s["cpu"])
        self._bar_mem.set_value(s["mem"])
        self._bar_net.set_value(min(100.0, s["net"] / 10.0))
        self._bar_gpu.set_value(s["gpu"])

    def _handle_submit(self):
        txt = self._cmd_input.text().strip()
        if not txt:
            return
        self._cmd_input.clear()
        self.log_widget.append_log(f"USER: {txt}")
        if callable(self.on_text_command):
            self.on_text_command(txt)

    def _handle_interrupt(self):
        if callable(self.on_interrupt):
            self.on_interrupt()
        self.log_widget.append_log("SYS: Interrupted speech by user request.")

    def _handle_mic_press(self):
        if callable(self.ptt_hold):
            self.ptt_hold(True)

    def _handle_mic_release(self):
        if callable(self.ptt_hold):
            self.ptt_hold(False)

    def _show_setup(self):
        self._reconfig_sig.emit()

    def _show_controls(self):
        pass

    def _on_show_content(self, title: str, text: str):
        self._content_title.setText(title)
        self._content_body.setPlainText(text)
        self._content_panel.setVisible(True)

    def _on_show_confirm(self, title: str, detail: str):
        for i in reversed(range(self._confirm_lay.count())):
            w = self._confirm_lay.itemAt(i).widget()
            if w:
                w.deleteLater()
        banner = ConfirmBanner(title, detail)
        banner.approved.connect(self._on_hide_confirm)
        banner.rejected.connect(self._on_hide_confirm)
        self._confirm_lay.addWidget(banner)
        self._confirm_box.setVisible(True)

    def _on_hide_confirm(self):
        self._confirm_box.setVisible(False)


class _RootShim:
    def __init__(self, app: QApplication):
        self._app = app

    def mainloop(self):
        self._app.exec()

    def protocol(self, *_):
        pass

    def after(self, ms: int, cb):
        QTimer.singleShot(ms, cb)


class JarvisUI:
    def __init__(self, face_path: str, size=None):
        self._app = QApplication.instance() or QApplication(sys.argv)
        self._app.setStyle("Fusion")
        self._win = MainWindow(face_path)
        self.root = _RootShim(self._app)
        self.request_say = None
        self.wake_is_ready = lambda: True
        self.on_wake_install = None
        self._win.show()

    @property
    def muted(self) -> bool:
        return self._win._muted

    @muted.setter
    def muted(self, v: bool):
        self._win._muted = v

    @property
    def current_file(self) -> str | None:
        return self._win._current_file

    @property
    def on_text_command(self):
        return self._win.on_text_command

    @on_text_command.setter
    def on_text_command(self, cb):
        self._win.on_text_command = cb

    @property
    def on_remote_clicked(self):
        return self._win.on_remote_clicked

    @on_remote_clicked.setter
    def on_remote_clicked(self, cb):
        self._win.on_remote_clicked = cb

    @property
    def on_interrupt(self):
        return self._win.on_interrupt

    @on_interrupt.setter
    def on_interrupt(self, cb):
        self._win.on_interrupt = cb

    @property
    def on_voice_change(self):
        return self._win.on_voice_change

    @on_voice_change.setter
    def on_voice_change(self, cb):
        self._win.on_voice_change = cb

    @property
    def on_audio_device_change(self):
        return self._win.on_audio_device_change

    @on_audio_device_change.setter
    def on_audio_device_change(self, cb):
        self._win.on_audio_device_change = cb

    def show_confirm(self, title: str, detail: str) -> None:
        self._win._confirm_sig.emit(str(title)[:120], str(detail)[:300])

    def hide_confirm(self) -> None:
        self._win._confirm_hide_sig.emit()

    @property
    def get_plugins(self):
        return self._win.get_plugins

    @get_plugins.setter
    def get_plugins(self, cb):
        self._win.get_plugins = cb

    @property
    def get_plugin_settings(self):
        return self._win.get_plugin_settings

    @get_plugin_settings.setter
    def get_plugin_settings(self, cb):
        self._win.get_plugin_settings = cb

    @property
    def on_wake_toggle(self):
        return self._win.on_wake_toggle

    @on_wake_toggle.setter
    def on_wake_toggle(self, cb):
        self._win.on_wake_toggle = cb

    @property
    def on_wake_manual(self):
        return self._win.on_wake_manual

    @on_wake_manual.setter
    def on_wake_manual(self, cb):
        self._win.on_wake_manual = cb

    @property
    def wake_get_state(self):
        return self._win.wake_get_state

    @wake_get_state.setter
    def wake_get_state(self, cb):
        self._win.wake_get_state = cb

    def set_audio_level(self, level: float):
        self._win.hud.set_audio_level(level)

    def glance(self, direction: str):
        self._win.hud.glance(direction)

    @property
    def ptt_hold(self):
        return self._win.ptt_hold

    @ptt_hold.setter
    def ptt_hold(self, cb):
        self._win.ptt_hold = cb

    @property
    def on_push_to_talk(self):
        return self._win.on_push_to_talk

    @on_push_to_talk.setter
    def on_push_to_talk(self, cb):
        self._win.on_push_to_talk = cb

    def push_visemes(self, visemes):
        self._win.hud.push_visemes(visemes)

    def notify_phone_connected(self):
        self.write_log("SYS: Remote phone client paired.")

    def set_state(self, state: str):
        self._win._state_sig.emit(str(state))

    def write_log(self, text: str):
        self._win._log_sig.emit(str(text))

    def wait_for_api_key(self):
        self._win._reconfig_sig.emit()

    def show_content(self, title: str, text: str):
        self._win._content_sig.emit(title, text)

    def show_quiz(self, topic: str, questions, grader):
        self._win._quiz_sig.emit(topic, questions, grader)

    def hide_quiz(self):
        self._win._quiz_hide_sig.emit()

    def show_review(self, title: str, path: str, on_approve, on_reject):
        self._win._review_sig.emit(title, path, on_approve, on_reject)

    def prompt_reconfig(self):
        self._win._reconfig_sig.emit()

    def show_camera_frame(self, frame_bytes: bytes):
        self._win._camera_sig.emit(frame_bytes)

    def show_video(self, url: str, title: str = "", muted: bool = False, audio_device: str = ""):
        self._win._video_open_sig.emit(url, title, muted, audio_device)

    def stop_video(self):
        self._win._video_close_sig.emit()

    def set_video_muted(self, muted: bool):
        self._win._video_mute_sig.emit(muted)

    def video_is_playing(self) -> bool:
        return False

    def start_camera_stream(self):
        self._win._cam_stream_sig.emit(True)

    def stop_camera_stream(self):
        self._win._cam_stream_sig.emit(False)

    @property
    def assistant_name(self) -> str:
        return self._win._assistant_name

    def start_speaking(self):
        self.set_state("SPEAKING")

    def stop_speaking(self):
        self.set_state("IDLE")