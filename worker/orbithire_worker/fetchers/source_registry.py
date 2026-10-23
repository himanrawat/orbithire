"""Source registry: the legal basis, attribution rules and production gates of
every job source (PRD area 9, reports/Low cost job data strategy.md).

Keep in sync with lib/jobs/sourceRegistry.ts and the `job_sources` table
(migration 20261024000200_us_job_supply.sql).

Production gates (worker env, both default off):

* ``ENABLE_TOS_RESTRICTED_SOURCES`` - LinkedIn, Glassdoor and Indeed through
  JobSpy. Their terms forbid unapproved automated collection, so they stay off
  unless counsel approves an experiment.
* ``ENABLE_INDIA_SOURCES`` - India-only boards (Naukri, Instahyre, Cutshort).
  NextMilestone is US-first, so they are opt-in.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

ENV_TOS_RESTRICTED = "ENABLE_TOS_RESTRICTED_SOURCES"
ENV_INDIA_SOURCES = "ENABLE_INDIA_SOURCES"
POLICY_ENV: tuple[str, ...] = (ENV_TOS_RESTRICTED, ENV_INDIA_SOURCES)

SourceKind = Literal["ats", "api", "jobspy", "scraper"]
_TRUTHY = {"1", "true", "yes", "on", "enabled"}


@dataclass(frozen=True)
class SourcePolicy:
    id: str
    label: str
    kind: SourceKind
    legal_basis: str
    home_url: str
    tos_restricted: bool = False
    india_only: bool = False
    # aggregator display rules: show "via <label>" with a followed link back
    attribution_required: bool = False


_p = SourcePolicy  # terse table below


_EMPLOYER = "Public employer ATS feed (employer-published postings; link to the employer's apply URL)"

SOURCES: dict[str, SourcePolicy] = {
    s.id: s
    for s in (
        # Employer ATS feeds: the backbone
        _p("greenhouse", "Greenhouse", "ats", _EMPLOYER, "https://www.greenhouse.com"),
        _p("ashby", "Ashby", "ats", _EMPLOYER, "https://www.ashbyhq.com"),
        _p("lever", "Lever", "ats", _EMPLOYER, "https://www.lever.co"),
        _p("smartrecruiters", "SmartRecruiters", "ats", _EMPLOYER, "https://www.smartrecruiters.com"),
        _p("workable", "Workable", "ats", _EMPLOYER, "https://www.workable.com"),
        _p("recruitee", "Recruitee", "ats", _EMPLOYER, "https://recruitee.com"),
        _p("personio", "Personio", "ats", _EMPLOYER, "https://www.personio.com"),
        _p("teamtailor", "Teamtailor", "ats", _EMPLOYER, "https://www.teamtailor.com"),
        # Public APIs
        _p("usajobs", "USAJOBS", "api",
           "OPM USAJOBS API terms: free key, commercial and noncommercial reuse of public data allowed",
           "https://www.usajobs.gov"),
        _p("himalayas", "Himalayas", "api",
           "Himalayas API terms: attribution and Himalayas apply URL required; no redistribution to job boards",
           "https://himalayas.app", attribution_required=True),
        _p("jobicy", "Jobicy", "api",
           "Jobicy public feed terms: credit Jobicy with a direct link to the source listing",
           "https://jobicy.com", attribution_required=True),
        _p("remoteok", "Remote OK", "api",
           "Remote OK API terms: mention Remote OK as the source with a followed link back; no logo",
           "https://remoteok.com", attribution_required=True),
        _p("remotive", "Remotive", "api",
           "Remotive public API: 24-hour delay, link back and attribution required; redistribution limited",
           "https://remotive.com", attribution_required=True),
        _p("arbeitnow", "Arbeitnow", "api",
           "Arbeitnow free API with backlink; commercial use unconfirmed (experimental)",
           "https://www.arbeitnow.com", attribution_required=True),
        _p("adzuna", "Adzuna", "api",
           "Adzuna developer terms: keyed, capped quota; commercial use may need a license",
           "https://www.adzuna.com", attribution_required=True),
        _p("jooble", "Jooble", "api", "Jooble REST API key: 500 lifetime requests (benchmark only)",
           "https://jooble.org", attribution_required=True),
        _p("reed", "Reed", "api", "Reed jobseeker API key (UK); terms not yet reviewed", "https://www.reed.co.uk"),
        _p("bundesagentur", "Bundesagentur für Arbeit", "api",
           "Community-documented public endpoint (experimental)", "https://www.arbeitsagentur.de"),
        _p("mycareersfuture", "MyCareersFuture", "api", "Singapore government public job search API",
           "https://www.mycareersfuture.gov.sg"),
        # JobSpy boards
        _p("linkedin", "LinkedIn", "jobspy",
           "Restricted: LinkedIn terms prohibit unapproved scraping", "https://www.linkedin.com",
           tos_restricted=True),
        _p("glassdoor", "Glassdoor", "jobspy",
           "Restricted: Glassdoor terms prohibit automated scraping", "https://www.glassdoor.com",
           tos_restricted=True),
        _p("indeed", "Indeed", "jobspy",
           "Restricted: Indeed terms prohibit unapproved scraping", "https://www.indeed.com",
           tos_restricted=True),
        _p("naukri", "Naukri", "jobspy", "India-only board via JobSpy (opt-in)", "https://www.naukri.com",
           india_only=True),
        _p("google", "Google Jobs", "jobspy", "Search-result discovery via JobSpy (experimental)",
           "https://www.google.com"),
        _p("zip_recruiter", "ZipRecruiter", "jobspy", "Board via JobSpy (experimental, terms not reviewed)",
           "https://www.ziprecruiter.com"),
        _p("bayt", "Bayt", "jobspy", "Board via JobSpy (experimental, terms not reviewed)", "https://www.bayt.com"),
        _p("bdjobs", "BDJobs", "jobspy", "Board via JobSpy (experimental, terms not reviewed)",
           "https://www.bdjobs.com"),
        # Tier 3 scrapers
        _p("wellfound", "Wellfound", "scraper", "Personal-scale scraper, robots.txt respected (opt-in)",
           "https://wellfound.com"),
        _p("instahyre", "Instahyre", "scraper", "India-only personal-scale scraper (opt-in)",
           "https://www.instahyre.com", india_only=True),
        _p("cutshort", "Cutshort", "scraper", "India-only personal-scale scraper (opt-in)",
           "https://cutshort.io", india_only=True),
        _p("seek", "SEEK", "scraper", "Blocked: requires a browser", "https://www.seek.com.au"),
    )
}


def _flag(env: Mapping[str, str], name: str) -> bool:
    """A gate is on when the given env mapping (or, failing that, the process
    environment) sets it to a truthy value."""
    value = env.get(name)
    if value is None:
        value = os.environ.get(name)
    return (value or "").strip().lower() in _TRUTHY


def policy_block(source_id: str, env: Mapping[str, str]) -> str | None:
    """Why a source must not run under the production gates, else None."""
    policy = SOURCES.get(source_id)
    if policy is None:
        return None
    if policy.tos_restricted and not _flag(env, ENV_TOS_RESTRICTED):
        return f"disabled: terms restrict automated access ({ENV_TOS_RESTRICTED} is off)"
    if policy.india_only and not _flag(env, ENV_INDIA_SOURCES):
        return f"disabled: India-only source ({ENV_INDIA_SOURCES} is off)"
    return None


def attribution_for(source_id: str, url: str | None) -> dict[str, str] | None:
    """Attribution record stored on job_postings.attribution for aggregator sources."""
    policy = SOURCES.get(source_id)
    if policy is None or not policy.attribution_required:
        return None
    return {"name": policy.label, "url": url or policy.home_url, "home_url": policy.home_url}
