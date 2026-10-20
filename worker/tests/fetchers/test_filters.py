from orbithire_worker.fetchers.filters import title_matches

POS = ["Frontend", "Front-End", "React", "Next.js", "Full Stack", "Software Engineer"]
NEG = ["Junior", "Intern", ".NET", "Java ", "C++", "SRE", "iOS"]


def test_include_and_exclude():
    assert title_matches("Senior Frontend Engineer", POS, NEG)
    assert title_matches("React Developer", POS, NEG)
    assert not title_matches("Junior Frontend Engineer", POS, NEG)
    assert not title_matches("Backend Engineer", POS, NEG)


def test_word_boundaries():
    # "Java " must not exclude JavaScript roles; "React" must not hit "Reactive"
    assert title_matches("Software Engineer (JavaScript)", POS, NEG)
    assert not title_matches("Software Engineer - Java", POS, NEG)
    assert not title_matches("Reactive Systems Lead", ["React"], [])
    # "SRE" should not match inside other words
    assert title_matches("Full Stack Engineer, Measurement", POS, NEG)
    assert not title_matches("Software Engineer, SRE", POS, NEG)


def test_symbol_keywords():
    assert not title_matches("Software Engineer .NET", POS, NEG)
    assert not title_matches("Software Engineer C++", POS, NEG)
    assert title_matches("Next.js Engineer", POS, NEG)


def test_space_hyphen_equivalence():
    assert title_matches("Full-Stack Engineer", ["Full Stack"], [])
    assert title_matches("Front End Developer", ["Front-End"], [])
    assert title_matches("Front End Developer", ["Front End"], [])


def test_empty_filters_accept_everything():
    assert title_matches("Anything", [], [])
    assert title_matches("Anything", None, None)
