#!/usr/bin/env python3
"""
EvalDesk Database & Storage Backup Helper
Safely backs up SQLite data/app.db and data/storage/ to timestamped backup directory.
Also supports restoring a previous backup with integrity verification.
"""

import argparse
import datetime
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "app.db"
STORAGE_DIR = DATA_DIR / "storage"
BACKUPS_DIR = ROOT_DIR / "backups"

def verify_sqlite_integrity(db_file: Path) -> bool:
    """Runs PRAGMA integrity_check on SQLite database."""
    if not db_file.exists():
        return False
    try:
        conn = sqlite3.connect(str(db_file))
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        res = cursor.fetchone()
        conn.close()
        return bool(res and res[0] == "ok")
    except Exception as e:
        print(f"Integrity check failed with error: {e}", file=sys.stderr)
        return False

def backup():
    """Creates a timestamped backup of the database and storage assets."""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}. Nothing to back up.")
        return 1

    # Verify existing DB first
    if not verify_sqlite_integrity(DB_PATH):
        print("ERROR: Source database integrity check failed! Aborting backup.", file=sys.stderr)
        return 1

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_target_dir = BACKUPS_DIR / f"backup_{timestamp}"
    backup_target_dir.mkdir(parents=True, exist_ok=True)
    target_db = backup_target_dir / "app.db"

    # Use SQLite online backup API to ensure clean snapshot even if open
    print(f"Backing up database to {target_db}...")
    src_conn = sqlite3.connect(str(DB_PATH))
    dst_conn = sqlite3.connect(str(target_db))
    src_conn.backup(dst_conn)
    dst_conn.close()
    src_conn.close()

    # Verify backup integrity
    if not verify_sqlite_integrity(target_db):
        print("ERROR: Backup database integrity verification failed!", file=sys.stderr)
        return 1

    print("[PASS] SQLite database backup verified successfully (PRAGMA integrity_check: ok).")

    # Backup storage assets if present
    if STORAGE_DIR.exists():
        target_storage = backup_target_dir / "storage"
        print(f"Copying storage assets to {target_storage}...")
        shutil.copytree(STORAGE_DIR, target_storage, dirs_exist_ok=True)
        print(f"[PASS] Storage assets backed up ({len(list(target_storage.rglob('*')))} files).")

    print(f"\nSUCCESS: Backup created at: {backup_target_dir}")
    return 0

def restore(backup_path_str: str):
    """Restores database and storage from a specified backup directory."""
    path = Path(backup_path_str)
    if not path.is_absolute():
        path = ROOT_DIR / path

    if path.is_file() and path.name.endswith(".db"):
        src_db = path
        src_storage = path.parent / "storage"
    elif path.is_dir():
        src_db = path / "app.db"
        src_storage = path / "storage"
    else:
        print(f"ERROR: Backup path does not exist: {path}", file=sys.stderr)
        return 1

    if not src_db.exists():
        print(f"ERROR: No app.db found at {src_db}", file=sys.stderr)
        return 1

    if not verify_sqlite_integrity(src_db):
        print("ERROR: Backup database failed integrity check! Restore cancelled.", file=sys.stderr)
        return 1

    # Safe restore: copy current to .pre_restore backup
    if DB_PATH.exists():
        pre_restore = DATA_DIR / f"app.db.pre_restore_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(DB_PATH, pre_restore)
        print(f"Pre-restore safety snapshot saved to: {pre_restore}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_db, DB_PATH)
    print(f"[PASS] Database restored to {DB_PATH}")

    if src_storage.exists() and src_storage.is_dir():
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src_storage, STORAGE_DIR, dirs_exist_ok=True)
        print(f"[PASS] Storage assets restored to {STORAGE_DIR}")

    print("\nSUCCESS: Restore completed successfully.")
    return 0

def main():
    parser = argparse.ArgumentParser(description="EvalDesk Backup & Restore Helper")
    parser.add_argument("--restore", help="Path to backup directory or app.db to restore", type=str)
    args = parser.parse_args()

    if args.restore:
        sys.exit(restore(args.restore))
    else:
        sys.exit(backup())

if __name__ == "__main__":
    main()
