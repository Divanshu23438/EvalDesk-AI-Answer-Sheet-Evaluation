import httpx
import json

url = "http://localhost:8000/api/papers"
data = {
    "title": "B.C.A. Linux Architecture Exam",
    "subject": "Linux OS",
    "strictness": "lenient",
    "checking_medium": "ai_reference",
}

with httpx.Client() as client:
    resp = client.post(url, data=data)
    print("Status Code:", resp.status_code)
    res_data = resp.json()
    print("Created Paper Response:")
    print(json.dumps(res_data, indent=2))

    paper_id = res_data["paper_id"]
    detail = client.get(f"http://localhost:8000/api/papers/{paper_id}").json()
    print("\nSaved Paper Details in SQLite:")
    print(f"Paper Title: {detail['paper']['title']}")
    print(f"Checking Medium: {detail['paper']['checking_medium']}")
    print(f"Has Answer Key: {detail['paper']['has_answer_key']} (0 = No Answer Key Used)")
    print(f"Drafted Questions Count: {len(detail['questions'])}")
    for q in detail['questions']:
        print(f"  Q.{q['q_no']}: {q['question_text']} ({q['max_marks']}M) [Type: {q['question_type']}]")
