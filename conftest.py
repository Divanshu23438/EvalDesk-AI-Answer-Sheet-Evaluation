import pytest
import backend.db as db
import backend.config as cfg
import backend.ai_gateway as gw
import backend.main as b_main
import backend.storage as storage

@pytest.fixture(autouse=True)
def _isolated_storage(tmp_path, monkeypatch):
    test_db = tmp_path / "test.db"
    test_cache = tmp_path / "cache"
    test_cache.mkdir(parents=True, exist_ok=True)
    test_storage = tmp_path / "storage"
    test_storage.mkdir(parents=True, exist_ok=True)
    test_papers = test_storage / "papers"
    test_sheets = test_storage / "sheets"
    test_reports = test_storage / "reports"
    test_exports = test_storage / "exports"
    test_papers.mkdir(parents=True, exist_ok=True)
    test_sheets.mkdir(parents=True, exist_ok=True)
    test_reports.mkdir(parents=True, exist_ok=True)
    test_exports.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(db, "DB_PATH", test_db)
    monkeypatch.setattr(cfg, "DB_PATH", test_db)
    monkeypatch.setattr(gw, "CACHE_DIR", test_cache)
    monkeypatch.setattr(b_main, "CACHE_DIR", test_cache)
    monkeypatch.setattr(cfg, "CACHE_DIR", test_cache)

    monkeypatch.setattr(storage, "STORAGE_DIR", test_storage)
    monkeypatch.setattr(storage, "PAPERS_STORAGE_DIR", test_papers)
    monkeypatch.setattr(storage, "SHEETS_STORAGE_DIR", test_sheets)
    monkeypatch.setattr(storage, "REPORTS_STORAGE_DIR", test_reports)
    monkeypatch.setattr(storage, "EXPORTS_STORAGE_DIR", test_exports)

    monkeypatch.setattr(cfg, "STORAGE_DIR", test_storage)
    monkeypatch.setattr(cfg, "PAPERS_STORAGE_DIR", test_papers)
    monkeypatch.setattr(cfg, "SHEETS_STORAGE_DIR", test_sheets)
    monkeypatch.setattr(cfg, "REPORTS_STORAGE_DIR", test_reports)
    monkeypatch.setattr(cfg, "EXPORTS_STORAGE_DIR", test_exports)

    db.init_db()
