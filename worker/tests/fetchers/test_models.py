import pytest

from orbithire_worker.fetchers.models import (
    NormalizedPosting,
    normalize_company,
    normalize_location,
    normalize_title,
)


def posting(company, title, location, source="linkedin", is_remote=False):
    return NormalizedPosting(
        source=source, url=f"https://x/{source}", company=company, title=title,
        location=location, is_remote=is_remote,
    )


def test_linkedin_and_naukri_same_job_collide():
    li = posting("Acme Pvt. Ltd.", "Senior Frontend Engineer", "Bangalore")
    nk = posting("ACME", "Senior Frontend Engineer", "Bengaluru, Karnataka", source="naukri")
    assert li.dedupe_key() == nk.dedupe_key()


def test_different_titles_do_not_collide():
    a = posting("Acme Pvt. Ltd.", "Senior Frontend Engineer", "Bangalore")
    b = posting("Acme Pvt. Ltd.", "Senior Backend Engineer", "Bangalore")
    assert a.dedupe_key() != b.dedupe_key()


def test_different_cities_do_not_collide():
    a = posting("Acme", "Frontend Engineer", "Pune, Maharashtra, India")
    b = posting("Acme", "Frontend Engineer", "Bengaluru, Karnataka, India")
    assert a.dedupe_key() != b.dedupe_key()


def test_key_is_sha1_hex():
    k = posting("Acme", "Dev", "Pune").dedupe_key()
    assert len(k) == 40 and int(k, 16) >= 0


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Acme Pvt. Ltd.", "acme"),
        ("ACME", "acme"),
        ("Acme Technologies Private Limited", "acme technologies"),
        ("Acme India Pvt Ltd", "acme"),
        ("Siemens AG", "siemens"),
        ("Zalando SE GmbH", "zalando se"),
        ("Stripe, Inc.", "stripe"),
        ("Loom (Atlassian)", "loom"),
        ("Procter & Gamble", "procter and gamble"),
        ("Société Générale", "societe generale"),
    ],
)
def test_normalize_company(raw, expected):
    assert normalize_company(raw) == expected


@pytest.mark.parametrize(
    "raw,remote,expected",
    [
        ("Bengaluru, Karnataka, India", False, "bangalore"),
        ("Bangalore", False, "bangalore"),
        ("Gurugram, Haryana", False, "gurgaon"),
        ("Gurgaon", False, "gurgaon"),
        ("New Delhi, Delhi, India", False, "delhi"),
        ("Remote - United States", False, "remote"),
        ("Work from home", False, "remote"),
        (None, True, "remote"),
        ("", False, ""),
        ("Hybrid - London", False, "london"),
        ("Mumbai (Hybrid)", False, "mumbai"),
        ("Greater Bengaluru Area", False, "bangalore"),
        ("Bangalore Rural, Karnataka, India", False, "bangalore"),
        ("Mumbai Metropolitan Region", False, "mumbai"),
        ("Bengaluru, Hyderabad, Mumbai (All Areas), India", False, "bangalore"),
    ],
)
def test_normalize_location(raw, remote, expected):
    assert normalize_location(raw, remote) == expected


def test_normalize_title():
    assert normalize_title("Sr. Front-End Engineer") == "senior frontend engineer"
    assert normalize_title("Senior Frontend Engineer") == "senior frontend engineer"
    assert normalize_title("Full-Stack Developer (React/Node)") == "fullstack developer react node"
