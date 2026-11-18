import pytest
import uuid
import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import get_db, init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def create_test_sheet_in_db():
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO papers (id, title, total_marks)
            VALUES (?, 'Annotation Test Paper', 100.0)
            """,
            (paper_id,),
        )
        conn.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status)
            VALUES (?, ?, 'Devanand Verma', 'CS-2026-304', 'evaluated')
            """,
            (sheet_id, paper_id),
        )
    return paper_id, sheet_id


def test_annotations_crud_lifecycle():
    paper_id, sheet_id = create_test_sheet_in_db()

    # 1. Initial GET on empty sheet
    res = client.get(f"/api/sheets/{sheet_id}/annotations")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 0
    assert data["annotations"] == []

    # 2. Batch PUT to insert annotations
    anno1_id = str(uuid.uuid4())
    anno2_id = str(uuid.uuid4())
    anno3_id = str(uuid.uuid4())

    put_payload = {
        "annotations": [
            {
                "id": anno1_id,
                "page_no": 1,
                "question_key": "Q1",
                "kind": "pen",
                "data": {"points": [{"x": 0.1, "y": 0.2}, {"x": 0.15, "y": 0.25}]},
                "color": "#ef4444",
                "width": 2.5,
                "visibility": "student",
            },
            {
                "id": anno2_id,
                "page_no": 1,
                "question_key": "Q1",
                "kind": "tick",
                "data": {"x": 0.85, "y": 0.22},
                "color": "#10b981",
                "width": 2.0,
                "visibility": "student",
            },
            {
                "id": anno3_id,
                "page_no": 2,
                "question_key": "Q2",
                "kind": "text",
                "data": {"x": 0.3, "y": 0.4, "text": "Needs clearer derivation"},
                "color": "#f59e0b",
                "visibility": "private",
            },
        ]
    }

    res_put = client.put(f"/api/sheets/{sheet_id}/annotations", json=put_payload)
    assert res_put.status_code == 200
    put_data = res_put.json()
    assert put_data["success"] is True
    assert put_data["saved_count"] == 3

    # 3. GET all annotations
    res_get_all = client.get(f"/api/sheets/{sheet_id}/annotations")
    assert res_get_all.status_code == 200
    all_annos = res_get_all.json()["annotations"]
    assert len(all_annos) == 3

    # 4. GET filtered by page
    res_p1 = client.get(f"/api/sheets/{sheet_id}/annotations?page=1")
    assert res_p1.status_code == 200
    p1_annos = res_p1.json()["annotations"]
    assert len(p1_annos) == 2
    assert all(a["page_no"] == 1 for a in p1_annos)

    res_p2 = client.get(f"/api/sheets/{sheet_id}/annotations?page=2")
    assert res_p2.status_code == 200
    p2_annos = res_p2.json()["annotations"]
    assert len(p2_annos) == 1
    assert p2_annos[0]["visibility"] == "private"
    assert p2_annos[0]["data"]["text"] == "Needs clearer derivation"

    # 5. Update an existing annotation (increment version)
    update_payload = {
        "annotations": [
            {
                "id": anno1_id,
                "page_no": 1,
                "kind": "pen",
                "data": {"points": [{"x": 0.1, "y": 0.2}, {"x": 0.2, "y": 0.3}]},
                "version": 1,
                "color": "#3b82f6",
            }
        ]
    }
    res_update = client.put(f"/api/sheets/{sheet_id}/annotations", json=update_payload)
    assert res_update.status_code == 200
    updated_anno = next(a for a in res_update.json()["annotations"] if a["id"] == anno1_id)
    assert updated_anno["version"] == 2
    assert updated_anno["color"] == "#3b82f6"

    # 6. Optimistic concurrency conflict detection
    conflict_payload = {
        "annotations": [
            {
                "id": anno1_id,
                "page_no": 1,
                "kind": "pen",
                "data": {"points": []},
                "version": 1, # Stale version (server has version 2)
            }
        ]
    }
    res_conflict = client.put(f"/api/sheets/{sheet_id}/annotations", json=conflict_payload)
    assert res_conflict.status_code == 409
    err = res_conflict.json()
    assert err["code"] == "VERSION_CONFLICT"
    assert err["retryable"] is True

    # 7. Soft delete via PUT deleted: True
    delete_payload = {
        "annotations": [
            {
                "id": anno2_id,
                "page_no": 1,
                "kind": "tick",
                "data": {},
                "deleted": True,
            }
        ]
    }
    res_del = client.put(f"/api/sheets/{sheet_id}/annotations", json=delete_payload)
    assert res_del.status_code == 200
    remaining_ids = [a["id"] for a in res_del.json()["annotations"]]
    assert anno2_id not in remaining_ids

    # 8. Clear all annotations on page 1
    res_clear = client.post(f"/api/sheets/{sheet_id}/annotations/clear?page=1")
    assert res_clear.status_code == 200
    assert res_clear.json()["success"] is True

    # Verify only page 2 annotation remains
    res_after_clear = client.get(f"/api/sheets/{sheet_id}/annotations")
    remaining_after = res_after_clear.json()["annotations"]
    assert len(remaining_after) == 1
    assert remaining_after[0]["id"] == anno3_id


def test_annotations_typed_error_handling():
    fake_sheet_id = str(uuid.uuid4())

    # 1. Non-existent sheet on GET
    res_get = client.get(f"/api/sheets/{fake_sheet_id}/annotations")
    assert res_get.status_code == 404
    err_get = res_get.json()
    assert err_get["code"] == "SHEET_NOT_FOUND"
    assert err_get["retryable"] is False

    # 2. Non-existent sheet on PUT
    res_put = client.put(
        f"/api/sheets/{fake_sheet_id}/annotations",
        json={"annotations": [{"id": str(uuid.uuid4()), "page_no": 1, "kind": "pen", "data": {}}]},
    )
    assert res_put.status_code == 404
    err_put = res_put.json()
    assert err_put["code"] == "SHEET_NOT_FOUND"

    # 3. Non-existent sheet on CLEAR
    res_clear = client.post(f"/api/sheets/{fake_sheet_id}/annotations/clear")
    assert res_clear.status_code == 404
    err_clear = res_clear.json()
    assert err_clear["code"] == "SHEET_NOT_FOUND"
