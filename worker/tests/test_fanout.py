"""Fetch-once fan-out planning (pure)."""

from orbithire_worker.fanout import FanoutPosting, SearchTarget, WatcherTarget, plan_fanout, search_accepts


def post(i: int, title: str = "Senior Frontend Engineer", **kw) -> FanoutPosting:
    return FanoutPosting(posting_id=f"p{i}", title=title, board_key=kw.pop("board_key", "greenhouse:acme"),
                         location=kw.pop("location", "New York, NY"), country=kw.pop("country", "US"), **kw)


def search(user: str = "u1", **kw) -> SearchTarget:
    return SearchTarget(user_id=user, search_id=f"s-{user}", keywords=kw.pop("keywords", ("frontend",)), **kw)


def test_keywords_are_the_title_filter_when_include_is_empty():
    assert search_accepts(search(), post(1))
    assert not search_accepts(search(), post(1, title="Account Executive"))
    assert search_accepts(search(include=("react",)), post(1, title="React Developer"))
    assert not search_accepts(search(include=("react",)), post(1))


def test_exclude_keywords_win():
    assert not search_accepts(search(exclude=("senior",)), post(1))


def test_country_and_remote_rules():
    assert not search_accepts(search(country="GB"), post(1))
    assert search_accepts(search(country="GB"), post(1, location="Remote"))
    assert not search_accepts(search(remote_ok=False), post(1, location="Remote - US"))
    # US employers posting abroad
    assert not search_accepts(search(), post(1, location="London, UK"))
    assert not search_accepts(search(), post(1, location="Remote (Canada)"))
    assert search_accepts(search(country="IN"), post(1, location="Bengaluru, Karnataka"))
    assert search_accepts(search(), post(1, location="Remote - US"))
    # user-only boards have no country: only watchers get them
    assert not search_accepts(search(), post(1, country=None))


def test_one_match_per_user_and_search_match_wins():
    watchers = {"greenhouse:acme": [WatcherTarget(user_id="u1")]}
    plan = plan_fanout([post(1)], [search("u1"), search("u1")], watchers)
    assert [(m.user_id, m.posting_id, m.search_id) for m in plan.matches] == [("u1", "p1", "s-u1")]


def test_watchers_get_board_jobs_through_their_title_filters():
    watchers = {"greenhouse:acme": [WatcherTarget(user_id="w1", exclude=("sales",)), WatcherTarget(user_id="w2")]}
    postings = [post(1, title="Sales Lead"), post(2, title="Designer"), post(3, board_key="lever:other")]
    plan = plan_fanout(postings, [], watchers)
    assert sorted((m.user_id, m.posting_id) for m in plan.matches) == [("w1", "p2"), ("w2", "p1"), ("w2", "p2")]
    assert all(m.search_id is None for m in plan.matches)


def test_per_user_cap():
    plan = plan_fanout([post(i) for i in range(5)], [search("u1"), search("u2")], max_per_user=2)
    assert len(plan.matches) == 4
    assert plan.capped == {"u1": 3, "u2": 3}
    assert plan.users == ["u1", "u2"]
