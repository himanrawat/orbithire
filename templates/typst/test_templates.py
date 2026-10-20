"""Render every Typst template against the samples and check the output.

Run:
    uv run --python 3.12 --with typst --with pypdf --with pytest \
        pytest templates/typst/test_templates.py -q
"""
from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

import pytest
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import render  # noqa: E402

SAMPLES = HERE / "samples"
PHOTO = SAMPLES / "photo.png"

META = {tid: render.load_meta(tid) for tid in render.template_ids()}
RESUMES = sorted(t for t, m in META.items() if m["kind"] == "resume")
LETTERS = sorted(t for t, m in META.items() if m["kind"] == "cover_letter")

# sample -> (headings that must appear, headings that must NOT appear)
RESUME_SAMPLES = {
    "resume-full": (
        ["Summary", "Skills", "Experience", "Education", "Projects", "Certifications", "Languages"],
        ["Awards", "Publications", "Volunteering", "References"],
    ),
    "resume-long": (
        ["Summary", "Skills", "Experience", "Education", "Projects", "Certifications", "Awards",
         "Publications", "Volunteering", "Languages", "Interests", "Leadership", "References"],
        [],
    ),
    "resume-minimal": (
        ["Experience"],
        ["Summary", "Skills", "Education", "Projects", "Certifications", "Languages"],
    ),
    "resume-eu": (
        ["Summary", "Experience", "Education", "Skills", "Certifications", "Languages", "Interests"],
        ["Projects", "Awards"],
    ),
    "resume-legacy": (
        ["Summary", "Skills", "Experience", "Education", "Certifications", "Languages", "Speaking"],
        ["Projects"],
    ),
}
LETTER_SAMPLES = ["cover-letter", "cover-letter-minimal"]


def load(name: str) -> dict:
    return json.loads((SAMPLES / f"{name}.json").read_text())


def compile_pdf(template: str, data: dict | str, **kw) -> PdfReader:
    pdf = render.render(template, data, fmt="pdf", **kw)
    assert isinstance(pdf, bytes) and pdf.startswith(b"%PDF")
    assert len(pdf) < 1_500_000, f"PDF unexpectedly large: {len(pdf)} bytes"
    return PdfReader(io.BytesIO(pdf))


def pdf_text(reader: PdfReader) -> str:
    return "\n".join(p.extract_text() or "" for p in reader.pages)


def squash(s: str) -> str:
    """Whitespace-insensitive, case-insensitive form for robust matching."""
    return re.sub(r"\s+", "", s).lower()


def assert_contains(haystack: str, needle: str) -> None:
    assert squash(needle) in squash(haystack), f"missing from PDF text: {needle!r}"


def heading_present(text: str, heading: str) -> bool:
    # Headings are standalone lines (possibly upper-cased by the template).
    lines = {squash(line) for line in text.splitlines()}
    return squash(heading) in lines


def resume_name(data: dict) -> str:
    return (data.get("basics") or {}).get("name") or data["personal"]["name"]


# ------------------------------------------------------------------ resumes

@pytest.mark.parametrize("sample", sorted(RESUME_SAMPLES))
@pytest.mark.parametrize("template", RESUMES)
def test_resume_renders_with_all_sections(template: str, sample: str) -> None:
    data = load(sample)
    photo = PHOTO if META[template]["photo"] else None
    reader = compile_pdf(template, data, photo=photo)
    text = pdf_text(reader)

    assert_contains(text, resume_name(data))
    must, must_not = RESUME_SAMPLES[sample]
    for h in must:
        assert heading_present(text, h), f"{template}/{sample}: heading {h!r} missing"
    for h in must_not:
        assert not heading_present(text, h), f"{template}/{sample}: empty section {h!r} rendered"

    # Every bullet must survive as extractable text (ATS parse check).
    work = data.get("work") or data.get("experience") or []
    for job in work:
        for bullet in job.get("highlights") or job.get("bullets") or []:
            assert_contains(text, bullet)
    summary = (data.get("basics") or {}).get("summary") or data.get("summary")
    if summary:
        assert_contains(text, summary)

    # Metadata
    assert resume_name(data) in (reader.metadata.title or "")


@pytest.mark.parametrize("template", RESUMES)
def test_page_counts(template: str) -> None:
    pages_full = len(compile_pdf(template, load("resume-full")).pages)
    pages_min = len(compile_pdf(template, load("resume-minimal")).pages)
    pages_long = len(compile_pdf(template, load("resume-long")).pages)
    assert pages_min == 1
    assert pages_long >= 2, "long content must flow onto a second page"
    assert pages_full <= 2
    if META[template]["onePage"]:
        assert pages_full == 1, f"{template} must fit the normal sample on one page"


def test_compact_is_one_page_on_letter_paper() -> None:
    reader = compile_pdf("compact", load("resume-full"), paper="letter")
    assert len(reader.pages) == 1
    assert round(float(reader.pages[0].mediabox.width)) == 612  # 8.5in


@pytest.mark.parametrize("template", RESUMES + LETTERS)
def test_paper_sizes(template: str) -> None:
    sample = load("resume-full" if template in RESUMES else "cover-letter")
    a4 = compile_pdf(template, sample)
    letter = compile_pdf(template, sample, paper="letter")
    assert round(float(a4.pages[0].mediabox.width)) == 595
    assert round(float(letter.pages[0].mediabox.width)) == 612


@pytest.mark.parametrize("template", RESUMES + LETTERS)
def test_accent_override_and_invalid_accent(template: str) -> None:
    sample = load("resume-full" if template in RESUMES else "cover-letter")
    compile_pdf(template, sample, accent="#7c3aed")
    compile_pdf(template, sample, accent="not-a-colour); #panic(")  # falls back, must not fail


def test_eu_photo_embeds_photo_only_when_given() -> None:
    def image_count(reader: PdfReader) -> int:
        n = 0
        for page in reader.pages:
            xobj = page.get("/Resources", {}).get("/XObject", {}) or {}
            n += sum(1 for o in xobj.values() if o.get_object().get("/Subtype") == "/Image")
        return n

    data = load("resume-eu")
    with_photo = compile_pdf("eu-photo", data, photo=PHOTO)
    without = compile_pdf("eu-photo", data)
    assert image_count(with_photo) >= 1
    assert image_count(without) == 0
    text = pdf_text(with_photo)
    for detail in ["17.04.1994", "German", "EU citizen", "Lindenstraße 12"]:
        assert_contains(text, detail)


def test_section_order_and_hidden_sections() -> None:
    data = load("resume-full")
    data["meta"] = {"sectionOrder": ["education", "experience", "summary"], "hiddenSections": ["skills", "projects"]}
    text = pdf_text(compile_pdf("ats-classic", data))
    lines = [squash(line) for line in text.splitlines()]
    pos = {h: lines.index(h) for h in ("education", "experience", "summary") if h in lines}
    assert pos["education"] < pos["experience"] < pos["summary"]
    assert "skills" not in lines and "projects" not in lines
    # Sections absent from sectionOrder but present in data are appended.
    assert "certifications" in lines and "languages" in lines


def test_custom_labels() -> None:
    data = load("resume-eu")
    data["meta"]["labels"] = {"experience": "Berufserfahrung", "education": "Ausbildung", "present": "heute"}
    text = pdf_text(compile_pdf("eu-photo", data))
    assert heading_present(text, "Berufserfahrung")
    assert heading_present(text, "Ausbildung")
    assert_contains(text, "Feb 2022 – heute")


def test_empty_data_does_not_crash() -> None:
    for template in RESUMES + LETTERS:
        reader = compile_pdf(template, {})
        assert len(reader.pages) == 1


# ------------------------------------------------------------ cover letters

@pytest.mark.parametrize("sample", LETTER_SAMPLES)
@pytest.mark.parametrize("template", LETTERS)
def test_cover_letter(template: str, sample: str) -> None:
    data = load(sample)
    reader = compile_pdf(template, data)
    assert len(reader.pages) == 1
    text = pdf_text(reader)
    assert_contains(text, data["basics"]["name"])
    paragraphs = data.get("paragraphs") or [p for p in data["content"].split("\n\n")]
    for p in paragraphs:
        assert_contains(text, p)
    for key in ("salutation", "closing"):
        if data.get(key):
            assert_contains(text, data[key])
    if "recipient" in data:
        assert_contains(text, data["recipient"]["company"])
        assert_contains(text, "October 20, 2026")


def test_long_cover_letter_flows_to_second_page() -> None:
    data = load("cover-letter")
    data["paragraphs"] = data["paragraphs"] * 4
    for template in LETTERS:
        assert len(compile_pdf(template, data).pages) == 2


# ---------------------------------------------------------------- injection

INJECTIONS = [
    "#set text(red)",
    "$x$",
    "#panic(\"boom\")",
    "*not bold* _not emph_ `not raw`",
    "<label> @ref = Heading",
    "]); #import \"/etc/passwd\"",
    "\\#escaped // not a comment",
]


@pytest.mark.parametrize("template", RESUMES)
def test_resume_user_text_is_literal(template: str) -> None:
    data = load("resume-full")
    data["basics"]["name"] = "Jo #set text(red) $x$"
    data["basics"]["label"] = INJECTIONS[3]
    data["basics"]["summary"] = " ".join(INJECTIONS)
    data["work"][0]["highlights"] = INJECTIONS
    data["skills"][0]["name"] = "#strong[Hack]"
    text = pdf_text(compile_pdf(template, data))
    assert_contains(text, "Jo #set text(red) $x$")
    for s in INJECTIONS:
        assert_contains(text, s)
    assert_contains(text, "#strong[Hack]")


@pytest.mark.parametrize("template", LETTERS)
def test_cover_letter_user_text_is_literal(template: str) -> None:
    data = load("cover-letter")
    data["salutation"] = "Dear #set text(red),"
    data["paragraphs"] = INJECTIONS
    data["signature"] = "$x$ #panic()"
    text = pdf_text(compile_pdf(template, data))
    assert_contains(text, "Dear #set text(red),")
    for s in INJECTIONS:
        assert_contains(text, s)
    assert_contains(text, "$x$ #panic()")
