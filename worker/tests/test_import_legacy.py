"""CSV mapper + filename matcher of the legacy import CLI (mirrors scripts/test-import.ts)."""

from __future__ import annotations

from pathlib import Path

from orbithire_worker.import_legacy import (
    IMPORT_MARKER,
    find_pdfs,
    import_file_key,
    map_row,
    map_status,
    match_filename,
    parse_pdf_filename,
    parse_tracker,
    plan_tracker,
    summarize,
)

HEADER = "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline"
CSV = "\n".join(
    [
        HEADER,
        '2026-10-20,Anthropic,Artificial Intelligence,"Product Designer, Safeguards",Product Design,online,drafted,,88,"Visa needed; ""quoted""",cv/main_anthropic_product_designer_safeguards.pdf,cover_letters/cover_anthropic_product_designer_safeguards.pdf,https://job-boards.greenhouse.io/anthropic/jobs/1,',
        "2026-10-18,Elastic,Software,UX Engineer,UX Engineering,online,applied,Jane Doe,94,,cv/main_elastic_ux_engineer.pdf,,https://jobs.elastic.co/x,2026-11-01",
        "2026-10-17,Acme,Software,Engineer,,referral,no response,,,,,,LinkedIn,",
        "2026-10-17,Acme,Software,Engineer,,referral,applied,,,,,,LinkedIn,",
        ",,,,,,,,,,,,,",
    ]
)


def test_status_mapping() -> None:
    assert map_status("drafted") == ("saved", True)
    assert map_status("interview")[0] == "interviewing"
    assert map_status("hired")[0] == "offered"
    assert map_status("no response")[0] == "rejected"
    assert map_status("no_response")[0] == "rejected"
    assert map_status("offer declined")[0] == "withdrawn"
    assert map_status("weird") == ("saved", False)


def test_row_mapping() -> None:
    rows = parse_tracker(CSV)
    assert len(rows) == 4  # blank row dropped
    a = map_row(rows[0])
    assert a is not None
    assert a["name"] == "Anthropic"
    assert a["job_title"] == "Product Designer, Safeguards"
    assert a["status"] == "saved" and a["applied_at"] is None
    assert a["job_url"] == "https://job-boards.greenhouse.io/anthropic/jobs/1"
    assert a["notes"].startswith(IMPORT_MARKER)
    assert "Fit rating: 88" in a["notes"]
    assert 'Visa needed; "quoted"' in a["notes"]
    b = map_row(rows[1])
    assert b is not None
    assert b["status"] == "applied" and b["applied_at"] == "2026-10-18T00:00:00.000Z"
    assert b["recruiter_name"] == "Jane Doe"
    c = map_row(rows[2])
    assert c is not None and c["job_url"] is None and "Source: LinkedIn" in c["notes"]
    assert map_row({"company": ""}) is None


def test_plan_is_idempotent_and_fills_gaps() -> None:
    plan = plan_tracker(CSV, [])
    assert summarize(plan) == {"total": 4, "create": 3, "update": 0, "skip": 1}
    existing = [{"id": f"id{i}", **p["changes"]} for i, p in enumerate(plan) if p["action"] == "create"]
    assert summarize(plan_tracker(CSV, existing)) == {"total": 4, "create": 0, "update": 0, "skip": 4}

    manual = [
        {"id": "m1", "name": "elastic", "job_title": "ux engineer", "status": "saved", "notes": "my note", "job_url": None, "industry": None, "recruiter_name": None, "applied_at": None},
        {"id": "m2", "name": "Anthropic", "job_title": "Product Designer, Safeguards", "status": "interviewing", "notes": None, "job_url": "https://x", "industry": "AI", "recruiter_name": None, "applied_at": None},
    ]
    upd = plan_tracker(CSV, manual)
    elastic = next(p for p in upd if p["mapped"]["name"] == "Elastic")
    assert elastic["action"] == "update" and elastic["existing_id"] == "m1"
    assert elastic["changes"]["status"] == "applied"
    assert elastic["changes"]["notes"].startswith("my note\n\n" + IMPORT_MARKER)
    anthropic = next(p for p in upd if p["mapped"]["name"] == "Anthropic")
    assert "status" not in anthropic["changes"]  # never backwards
    assert "job_url" not in anthropic["changes"]  # never overwrite


COMPANIES = [
    {"id": "c1", "name": "Anthropic", "job_title": "Product Designer, Claude Developer Platform", "notes": None},
    {"id": "c2", "name": "Anthropic", "job_title": "Product Designer, Safeguards", "notes": None},
    {"id": "c3", "name": "CDW", "job_title": "Product Designer-1", "notes": None},
    {"id": "c4", "name": "Scope AI", "job_title": "Product Designer", "notes": None},
    {"id": "c5", "name": "Cal.com", "job_title": "Design Engineer", "notes": None},
    {"id": "c6", "name": "Postman", "job_title": "Software Engineer", "notes": "Imported from job_search_tracker.csv\nCV file: cv/main_postman_software_engineer_frontend_ui.pdf"},
]


def test_filename_parsing() -> None:
    assert parse_pdf_filename("cv/main_elastic_ux_engineer.pdf") == ("resume", "elastic_ux_engineer")
    assert parse_pdf_filename("cover_elastic_ux_engineer.PDF") == ("cover_letter", "elastic_ux_engineer")
    assert parse_pdf_filename("My Cover Letter.pdf")[0] == "cover_letter"


def test_filename_matching() -> None:
    m = match_filename("main_anthropic_product_designer_safeguards.pdf", COMPANIES)
    assert (m["company_id"], m["confidence"]) == ("c2", "exact")
    assert m["title"] == "CV – Anthropic – Product Designer, Safeguards (imported)"
    assert match_filename("cover_anthropic_product_designer_claude_developer_platform.pdf", COMPANIES)["company_id"] == "c1"
    assert match_filename("main_cdw_product_designer_1.pdf", COMPANIES)["confidence"] == "exact"
    assert match_filename("main_scope_ai_product_designer.pdf", COMPANIES)["company_id"] == "c4"
    cal = match_filename("main_calcom_senior_product_design_engineer.pdf", COMPANIES)
    assert (cal["company_id"], cal["confidence"]) == ("c5", "role")
    tr = match_filename("main_postman_software_engineer_frontend_ui.pdf", COMPANIES)
    assert (tr["company_id"], tr["confidence"]) == ("c6", "tracker")
    none = match_filename("main_gitlab_senior_frontend_engineer.pdf", COMPANIES)
    assert none["company_id"] is None and none["confidence"] == "none"
    assert none["title"] == "CV – Gitlab Senior Frontend Engineer (imported)"
    assert match_filename("main_example.pdf", COMPANIES)["suggest_skip"] is True
    assert match_filename("main_calcom_x.pdf", [{"id": "z", "name": "Cal", "job_title": "X"}])["company_id"] is None


def test_import_file_key_matches_ts() -> None:
    assert import_file_key("u1", "resume", "cv/Main_Elastic UX.pdf") == "u1/resumes/import-main-elastic-ux.pdf"
    assert import_file_key("u1", "cover_letter", "cover_x.pdf") == "u1/cover-letters/import-cover-x.pdf"


def test_find_pdfs(tmp_path: Path) -> None:
    (tmp_path / "cv").mkdir()
    (tmp_path / "cover_letters").mkdir()
    (tmp_path / "cv" / "main_a.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "cv" / "main_a.tex").write_text("x")
    (tmp_path / "cover_letters" / "cover_a.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "other.pdf").write_bytes(b"%PDF-1.4")
    assert [p.name for p in find_pdfs(tmp_path)] == ["main_a.pdf", "cover_a.pdf"]
    assert [p.name for p in find_pdfs(tmp_path / "cv")] == ["main_a.pdf"]
