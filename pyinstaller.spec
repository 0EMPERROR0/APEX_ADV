# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Specification for A.P.E.X Desktop Application
Builds standalone Windows executable containing Python backend, PySide6 Qt WebEngine, and compiled React UI.

Usage:
    pyinstaller pyinstaller.spec
"""

import sys
import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None
project_root = Path(__file__).parent.resolve()

# Collect Qt WebEngine resources & data
datas = [
    (str(project_root / "dist"), "dist"),
]

# Try to include .env.example
if (project_root / ".env.example").exists():
    datas.append((str(project_root / ".env.example"), "."))

hiddenimports = [
    "PySide6.QtCore",
    "PySide6.QtGui",
    "PySide6.QtWidgets",
    "PySide6.QtWebEngineCore",
    "PySide6.QtWebEngineWidgets",
    "PySide6.QtWebChannel",
    "desktop",
    "desktop.window",
    "desktop.bridge",
    "desktop.agent_service",
    "dotenv",
    "requests",
    "urllib.request",
]

a = Analysis(
    ["main.py"],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="APEX",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # False = no console window for polished release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(project_root / "dist" / "favicon.ico") if (project_root / "dist" / "favicon.ico").exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="APEX",
)
