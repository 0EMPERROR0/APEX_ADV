"""
A.P.E.X Desktop Window
Native Windows application window using PySide6 and Qt WebEngine.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional

from PySide6.QtCore import QUrl, Qt
from PySide6.QtGui import QIcon, QColor, QPalette
from PySide6.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QMessageBox
from PySide6.QtWebEngineCore import (
    QWebEngineSettings,
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineScript,
)
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel

from .bridge import ApexBridge
from .agent_service import ApexAgentService

logger = logging.getLogger("ApexWindow")


class ApexWebEnginePage(QWebEnginePage):
    """
    Custom WebEnginePage that automatically grants audio/microphone permissions
    for the voice session and handles console logs.
    """

    def __init__(self, profile=None, parent=None):
        super().__init__(profile, parent)
        self.featurePermissionRequested.connect(self._on_permission_requested)

    def _on_permission_requested(self, security_origin: QUrl, feature: QWebEnginePage.Feature):
        # Auto-grant media audio capture (Microphone) for the local app
        if feature in (
            QWebEnginePage.Feature.MediaAudioCapture,
            QWebEnginePage.Feature.MediaAudioVideoCapture,
        ):
            logger.info(f"Auto-granting media capture permission for {security_origin.toString()}")
            self.setFeaturePermission(
                security_origin, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
            )
        else:
            self.setFeaturePermission(
                security_origin, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
            )

    def javaScriptConsoleMessage(
        self,
        level: QWebEnginePage.JavaScriptConsoleMessageLevel,
        message: str,
        line_number: int,
        source_id: str,
    ):
        # Filter noisy HMR or font notices
        if "WebSocket" in message or "vite" in message:
            return
        logger.debug(f"[JS Console] {source_id}:{line_number} -> {message}")


class ApexMainWindow(QMainWindow):
    """
    Main Native Windows Desktop Window for A.P.E.X.
    """

    def __init__(self, api_key: Optional[str] = None, parent=None):
        super().__init__(parent)
        self.agent_service = ApexAgentService(api_key=api_key)
        self.bridge = ApexBridge(service=self.agent_service, parent=self)

        self._init_window_properties()
        self._init_web_engine()
        self._load_frontend()

    def _init_window_properties(self):
        """Configures native window geometry, dark theme, and titles."""
        self.setWindowTitle("A.P.E.X — Autonomous Desktop Agent")
        self.setMinimumSize(960, 640)
        self.resize(1280, 820)

        # Set dark window palette
        palette = self.palette()
        palette.setColor(QPalette.ColorRole.Window, QColor(9, 10, 15))
        palette.setColor(QPalette.ColorRole.WindowText, QColor(241, 245, 249))
        self.setPalette(palette)

        # Icon if available
        icon_path = Path(__file__).parent.parent / "dist" / "favicon.ico"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))

    def _init_web_engine(self):
        """Initializes Qt WebEngine and registers the QWebChannel bridge."""
        self.view = QWebEngineView(self)
        self.page = ApexWebEnginePage(parent=self.view)
        self.view.setPage(self.page)

        # WebEngine settings for local desktop execution
        settings = self.view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebAudioEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)

        # Setup Qt WebChannel
        self.channel = QWebChannel(self.page)
        self.channel.registerObject("apexBridge", self.bridge)
        self.page.setWebChannel(self.channel)

        # Central layout
        central_widget = QWidget(self)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.view)
        self.setCentralWidget(central_widget)

    def _load_frontend(self):
        """Locates and loads the local React build or dev server URL."""
        # 1. Check if dev URL was supplied via environment variable (hot-reload mode)
        dev_url = os.environ.get("APEX_DEV_URL")
        if dev_url:
            logger.info(f"Loading frontend from development URL: {dev_url}")
            self.view.setUrl(QUrl(dev_url))
            return

        # 2. Look for local production build (dist/index.html or ui/dist/index.html)
        project_root = Path(__file__).parent.parent
        possible_paths = [
            project_root / "dist" / "index.html",
            project_root / "ui" / "dist" / "index.html",
            Path(getattr(sys, "_MEIPASS", project_root)) / "dist" / "index.html",
        ]

        found_path: Optional[Path] = None
        for p in possible_paths:
            if p.exists():
                found_path = p.resolve()
                break

        if found_path:
            logger.info(f"Loading local compiled frontend from: {found_path}")
            self.view.setUrl(QUrl.fromLocalFile(str(found_path)))
        else:
            logger.warning("dist/index.html not found. Displaying build instructions.")
            self._display_missing_build_page(possible_paths[0])

    def _display_missing_build_page(self, expected_path: Path):
        """Displays friendly message when frontend hasn't been built yet."""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    background: #090a0f;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }}
                .container {{
                    max-width: 540px;
                    padding: 32px;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    background: rgba(255,255,255,0.03);
                }}
                h1 {{ font-size: 20px; font-weight: 600; margin-bottom: 8px; }}
                p {{ font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }}
                code {{
                    display: block;
                    background: #020617;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 13px;
                    color: #38bdf8;
                    margin-bottom: 20px;
                    border: 1px solid rgba(56,189,248,0.2);
                }}
                button {{
                    background: #f8fafc;
                    color: #090a0f;
                    border: none;
                    padding: 10px 20px;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Compiled Frontend Not Found</h1>
                <p>The A.P.E.X desktop window requires the compiled static React build to run locally.</p>
                <code>npm run build</code>
                <p>After running the build command in PowerShell or terminal, click below to reload:</p>
                <button onclick="location.reload()">Check Again & Reload</button>
            </div>
        </body>
        </html>
        """
        self.view.setHtml(html, QUrl.fromLocalFile(str(expected_path.parent)))

    def closeEvent(self, event):
        """Clean shutdown handler."""
        logger.info("A.P.E.X desktop application closing.")
        self.bridge.emergencyStop()
        event.accept()
