#!/usr/bin/env python3
"""
A.P.E.X — Autonomous Desktop Agent
Native Windows Desktop Application Entry Point

Launch command:
    python main.py
"""

import os
import sys
from pathlib import Path

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        # Also check .env.local
        env_local = Path(__file__).parent / ".env.local"
        if env_local.exists():
            load_dotenv(dotenv_path=env_local)
except ImportError:
    pass

# Ensure desktop package is importable
sys.path.insert(0, str(Path(__file__).parent))

def main():
    try:
        from PySide6.QtCore import Qt, QCoreApplication
        from PySide6.QtWidgets import QApplication
        from desktop.window import ApexMainWindow
    except ImportError as e:
        print(f"\n[ERROR] Missing desktop dependencies: {e}")
        print("\nPlease install the required Python desktop packages:")
        print("    pip install -r requirements.txt\n")
        sys.exit(1)

    # Configure high-DPI scaling and application metadata
    QCoreApplication.setApplicationName("A.P.E.X")
    QCoreApplication.setOrganizationName("APEX")
    QCoreApplication.setOrganizationDomain("apex.local")

    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    # API key from environment
    api_key = os.environ.get("GEMINI_API_KEY", "")

    # Create and show the native Windows desktop window
    window = ApexMainWindow(api_key=api_key)
    window.show()

    # Enter native Qt event loop
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
