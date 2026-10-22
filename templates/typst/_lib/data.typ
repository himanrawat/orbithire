// NextMilestone shared data layer for Typst templates.
//
// Everything user-supplied arrives as JSON via `sys.inputs.data` and is only
// ever handled as Typst *values* (str / array / dictionary). Strings are
// placed into the document as text, never evaluated as markup or code, so
// content such as `#set text(red)` or `$x$` is printed literally.
//
// This module normalises both resume shapes found in the app:
//   * JSON Resume (lib/sampleResume.ts `JSONResume`, incl. `meta.sectionOrder`
//     / `meta.hiddenSections`) – the shape stored in resumes.content_json;
//   * the legacy `ResumeContent` shape (lib/types/database.ts: `personal`,
//     `experience`, `certifications`, `custom_sections`, ...).

// ---------------------------------------------------------------- inputs ---

#let input(key, default: none) = sys.inputs.at(key, default: default)

#let load-data() = {
  let raw = input("data")
  if raw == none or raw.trim() == "" { (:) } else {
    let d = json(bytes(raw))
    if type(d) == dictionary { d } else { (:) }
  }
}

// Accent colour from `sys.inputs.accent` ("#RRGGBB" / "RRGGBB"), else default.
#let accent-color(default) = {
  let a = input("accent", default: "")
  if type(a) == str and a.trim().match(regex("^#?[0-9a-fA-F]{6}$")) != none {
    let a = a.trim()
    rgb(if a.starts-with("#") { a } else { "#" + a })
  } else { rgb(default) }
}

// Paper from `sys.inputs.paper`: "a4" (default) or "letter"/"us-letter".
#let paper-size() = {
  let p = lower(str(input("paper", default: "a4"))).trim()
  if p in ("letter", "us-letter", "usletter", "us") { "us-letter" } else { "a4" }
}

// Photo path from `sys.inputs.photo` (root-relative, e.g. "/tmp/x/photo.jpg").
#let photo-path() = {
  let p = input("photo", default: "")
  if type(p) == str and p.trim() != "" { p.trim() } else { none }
}

// ------------------------------------------------------------ coercions ---

// Any JSON scalar -> trimmed string ("" for null / objects / arrays / bools).
#let S(x) = {
  if x == none { "" }
  else if type(x) == str { x.trim() }
  else if type(x) == int or type(x) == float { str(x) }
  else { "" }
}
#let has(x) = S(x) != ""
#let A(x) = if type(x) == array { x } else { () }
#let D(x) = if type(x) == dictionary { x } else { (:) }

// First non-empty string among `keys` of dictionary `d`.
#let pick(d, ..keys) = {
  let d = D(d)
  for k in keys.pos() {
    let v = S(d.at(k, default: none))
    if v != "" { return v }
  }
  ""
}
// First array-ish value among `keys`; a plain string becomes a 1-item array.
#let pick-list(d, ..keys) = {
  let d = D(d)
  for k in keys.pos() {
    let v = d.at(k, default: none)
    if type(v) == array {
      let out = v.map(S).filter(s => s != "")
      if out.len() > 0 { return out }
    } else if has(v) { return (S(v),) }
  }
  ()
}
#let join-nonempty(parts, sep) = parts.map(S).filter(s => s != "").join(sep, default: "")

#let capitalize(s) = {
  let s = S(s)
  if s == "" { s } else { upper(s.first()) + s.slice(s.first().len()) }
}

// ------------------------------------------------------------- labels ---

#let default-labels = (
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certificates: "Certifications",
  awards: "Awards",
  publications: "Publications",
  volunteer: "Volunteering",
  languages: "Languages",
  interests: "Interests",
  references: "References",
  present: "Present",
  gpa: "GPA",
  coursework: "Coursework",
  // eu-photo header / personal details
  address: "Address",
  phone: "Phone",
  email: "Email",
  website: "Website",
  birthDate: "Date of birth",
  placeOfBirth: "Place of birth",
  nationality: "Nationality",
  workPermit: "Work permit",
  drivingLicense: "Driving licence",
  maritalStatus: "Marital status",
)

// --------------------------------------------------------------- dates ---

#let month-names = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

#let fmt-date(s, labels: default-labels) = {
  let s = S(s)
  if s == "" { return "" }
  if lower(s) in ("present", "current", "now", "today", "ongoing") {
    return labels.at("present", default: "Present")
  }
  let m = s.match(regex("^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[T ].*)?$"))
  if m != none {
    let mi = int(m.captures.at(1))
    if mi >= 1 and mi <= 12 { return month-names.at(mi - 1) + " " + m.captures.at(0) }
    return m.captures.at(0)
  }
  s
}

// "Mar 2021 – Present". `open` = a missing end date means "Present".
#let date-range(start, end, open: true, current: false, labels: default-labels) = {
  let s = fmt-date(start, labels: labels)
  let e = if current { labels.at("present", default: "Present") } else { fmt-date(end, labels: labels) }
  if s == "" and e == "" { "" }
  else if s == "" { e }
  else if e == "" { if open { s + " – " + labels.at("present", default: "Present") } else { s } }
  else if s == e { s }
  else { s + " – " + e }
}

// ---------------------------------------------------------------- urls ---

#let safe-url(u) = {
  let u = S(u)
  if u == "" { return none }
  let l = lower(u)
  if l.starts-with("http://") or l.starts-with("https://") or l.starts-with("mailto:") or l.starts-with("tel:") { u }
  else if u.contains(" ") or not u.contains(".") { none }
  else { "https://" + u }
}
#let pretty-url(u) = {
  let u = S(u)
  for p in ("https://", "http://") { if lower(u).starts-with(p) { u = u.slice(p.len()) } }
  if u.starts-with("www.") { u = u.slice(4) }
  u.trim("/", at: end)
}

// ------------------------------------------------------------- basics ---

#let format-location(loc, full: false) = {
  if type(loc) == str { return loc.trim() }
  let l = D(loc)
  let city = S(l.at("city", default: none))
  let region = S(l.at("region", default: none))
  let cc = S(l.at("countryCode", default: none))
  let country = S(l.at("country", default: none))
  if full {
    let street = S(l.at("address", default: none))
    let pc = S(l.at("postalCode", default: none))
    join-nonempty((street, join-nonempty((pc, city), " "), region, if country != "" { country } else { cc }), ", ")
  } else {
    // "City, Region" when a region exists; otherwise "City, Country".
    let tail = if region != "" { region } else if country != "" { country } else if city != "" and cc != "" and cc != "US" { cc } else { "" }
    join-nonempty((city, tail), ", ")
  }
}

#let normalize-basics(d, labels: default-labels) = {
  let b = D(d.at("basics", default: none))
  let p = D(d.at("personal", default: none)) // legacy ResumeContent
  let loc = b.at("location", default: p.at("location", default: none))

  let profiles = A(b.at("profiles", default: ())).map(D).map(x => (
    network: S(x.at("network", default: none)),
    username: S(x.at("username", default: none)),
    url: S(x.at("url", default: none)),
  )).filter(x => x.url != "" or x.username != "")
  if has(p.at("linkedin", default: none)) {
    profiles.push((network: "LinkedIn", username: "", url: S(p.linkedin)))
  }

  // Personal details (eu-photo): well-known keys first, then explicit lists.
  let details = ()
  for key in ("birthDate", "placeOfBirth", "nationality", "workPermit", "drivingLicense", "maritalStatus") {
    if has(b.at(key, default: none)) {
      let raw = S(b.at(key))
      let value = if key == "birthDate" and raw.match(regex("^\d{4}-\d{2}-\d{2}$")) != none {
        // Full birth dates use the European DD.MM.YYYY form.
        let parts = raw.split("-")
        parts.at(2) + "." + parts.at(1) + "." + parts.at(0)
      } else { raw }
      details.push((label: labels.at(key, default: default-labels.at(key)), value: value))
    }
  }
  for src in (b.at("personalDetails", default: none), b.at("customFields", default: none),
              b.at("custom_fields", default: none), d.at("custom_fields", default: none)) {
    for x in A(src).map(D) {
      let label = S(x.at("label", default: none))
      let value = S(x.at("value", default: none))
      if label != "" and value != "" { details.push((label: label, value: value)) }
    }
  }

  (
    name: if has(b.at("name", default: none)) { S(b.name) } else { pick(p, "name") },
    label: if has(b.at("label", default: none)) { S(b.label) } else { pick(p, "headline", "label") },
    email: if has(b.at("email", default: none)) { S(b.email) } else { pick(p, "email") },
    phone: if has(b.at("phone", default: none)) { S(b.phone) } else { pick(p, "phone") },
    url: if has(b.at("url", default: none)) { S(b.url) } else { pick(p, "portfolio", "website", "url") },
    summary: if has(b.at("summary", default: none)) { S(b.summary) } else { S(d.at("summary", default: none)) },
    location: format-location(loc),
    address: format-location(loc, full: true),
    image: if has(b.at("image", default: none)) { S(b.image) } else { pick(p, "avatar_url") },
    profiles: profiles,
    details: details,
  )
}

// Contact items: (kind, text, url). Templates decide how to draw them.
#let contact-items(basics, with-location: true) = {
  let items = ()
  if basics.email != "" { items.push((kind: "email", text: basics.email, url: "mailto:" + basics.email)) }
  if basics.phone != "" {
    items.push((kind: "phone", text: basics.phone, url: "tel:" + basics.phone.replace(regex("[^0-9+]"), "")))
  }
  if with-location and basics.location != "" { items.push((kind: "location", text: basics.location, url: none)) }
  if basics.url != "" { items.push((kind: "web", text: pretty-url(basics.url), url: safe-url(basics.url))) }
  for p in basics.profiles {
    let text = if p.url != "" { pretty-url(p.url) } else { join-nonempty((p.network, p.username), ": ") }
    items.push((kind: lower(p.network), text: text, url: safe-url(p.url)))
  }
  items
}

// ------------------------------------------------------------ sections ---
// Each section normalises to (id, title, kind, items):
//   kind "text"    -> items: str
//   kind "entries" -> items: array of entry dicts
//                     (title, org, date, location, url, summary, bullets, tags)
//   kind "pairs"   -> items: array of (label, value)

#let entry(title: "", org: "", date: "", location: "", url: "", summary: "", bullets: (), tags: ()) = (
  title: title, org: org, date: date, location: location, url: url,
  summary: summary, bullets: bullets, tags: tags,
)

#let section-list(d, ..keys) = {
  for k in keys.pos() {
    let v = d.at(k, default: none)
    if type(v) == array and v.len() > 0 { return v.map(D) }
  }
  ()
}

#let build-sections(d, labels) = {
  let L(k) = labels.at(k, default: default-labels.at(k, default: k))
  let sections = (:)
  let basics = normalize-basics(d)

  if basics.summary != "" {
    sections.insert("summary", (id: "summary", title: L("summary"), kind: "text", items: basics.summary))
  }

  let work = section-list(d, "work", "experience").map(w => entry(
    title: pick(w, "position", "title", "role"),
    org: pick(w, "name", "company", "organization"),
    date: date-range(pick(w, "startDate", "start_date"), pick(w, "endDate", "end_date"),
                     current: w.at("is_current", default: false) == true, labels: labels),
    location: if type(w.at("location", default: none)) == dictionary { format-location(w.location) } else { pick(w, "location") },
    url: pick(w, "url"),
    summary: pick(w, "summary", "description"),
    bullets: pick-list(w, "highlights", "bullets"),
  )).filter(e => e.title != "" or e.org != "")
  if work.len() > 0 { sections.insert("experience", (id: "experience", title: L("experience"), kind: "entries", items: work)) }

  let edu = section-list(d, "education").map(e => {
    let degree = pick(e, "studyType", "degree")
    let area = pick(e, "area", "field")
    let title = if degree != "" and area != "" and not degree.contains(area) { degree + " in " + area } else if degree != "" { degree } else { area }
    let score = pick(e, "score", "gpa")
    let bullets = ()
    if score != "" {
      bullets.push(if score.match(regex("^[0-9.,/ ]+$")) != none { L("gpa") + ": " + score } else { score })
    }
    for h in pick-list(e, "honors") { bullets.push(h) }
    let courses = pick-list(e, "courses")
    if courses.len() > 0 { bullets.push(L("coursework") + ": " + courses.join(", ")) }
    entry(
      title: title,
      org: pick(e, "institution", "school"),
      date: date-range(pick(e, "startDate", "start_date"), pick(e, "endDate", "end_date"), open: false, labels: labels),
      location: if type(e.at("location", default: none)) == dictionary { format-location(e.location) } else { pick(e, "location") },
      url: pick(e, "url"),
      summary: pick(e, "summary", "description"),
      bullets: bullets,
    )
  }).filter(e => e.title != "" or e.org != "")
  if edu.len() > 0 { sections.insert("education", (id: "education", title: L("education"), kind: "entries", items: edu)) }

  let skills = section-list(d, "skills").map(s => {
    let kw = pick-list(s, "keywords", "skills")
    (label: pick(s, "name", "category"), value: if kw.len() > 0 { kw.join(", ") } else { pick(s, "level") })
  }).filter(p => p.value != "" or p.label != "")
  if skills.len() > 0 { sections.insert("skills", (id: "skills", title: L("skills"), kind: "pairs", items: skills)) }

  let projects = section-list(d, "projects").map(p => entry(
    title: pick(p, "name", "title"),
    org: join-nonempty((pick(p, "entity"), pick-list(p, "roles").join(", ", default: "")), " · "),
    date: date-range(pick(p, "startDate", "start_date"), pick(p, "endDate", "end_date"), open: false, labels: labels),
    url: pick(p, "url"),
    summary: pick(p, "description", "summary"),
    bullets: pick-list(p, "highlights", "bullets"),
    tags: pick-list(p, "keywords"),
  )).filter(e => e.title != "")
  if projects.len() > 0 { sections.insert("projects", (id: "projects", title: L("projects"), kind: "entries", items: projects)) }

  let certs = section-list(d, "certificates", "certifications").map(c => entry(
    title: pick(c, "name", "title"), org: pick(c, "issuer"), date: fmt-date(pick(c, "date"), labels: labels), url: pick(c, "url"),
  )).filter(e => e.title != "")
  if certs.len() > 0 { sections.insert("certificates", (id: "certificates", title: L("certificates"), kind: "entries", items: certs)) }

  let awards = section-list(d, "awards").map(a => entry(
    title: pick(a, "title", "name"), org: pick(a, "awarder"), date: fmt-date(pick(a, "date"), labels: labels), summary: pick(a, "summary"),
  )).filter(e => e.title != "")
  if awards.len() > 0 { sections.insert("awards", (id: "awards", title: L("awards"), kind: "entries", items: awards)) }

  let pubs = section-list(d, "publications").map(p => entry(
    title: pick(p, "name", "title"), org: pick(p, "publisher"), date: fmt-date(pick(p, "releaseDate", "date"), labels: labels),
    url: pick(p, "url"), summary: pick(p, "summary"),
  )).filter(e => e.title != "")
  if pubs.len() > 0 { sections.insert("publications", (id: "publications", title: L("publications"), kind: "entries", items: pubs)) }

  let vol = section-list(d, "volunteer").map(v => entry(
    title: pick(v, "position"), org: pick(v, "organization", "name"),
    date: date-range(pick(v, "startDate"), pick(v, "endDate"), labels: labels),
    url: pick(v, "url"), summary: pick(v, "summary"), bullets: pick-list(v, "highlights"),
  )).filter(e => e.title != "" or e.org != "")
  if vol.len() > 0 { sections.insert("volunteer", (id: "volunteer", title: L("volunteer"), kind: "entries", items: vol)) }

  let langs = section-list(d, "languages").map(l => (
    label: pick(l, "language", "name"), value: capitalize(pick(l, "fluency", "proficiency", "level")),
  )).filter(p => p.label != "")
  if langs.len() > 0 { sections.insert("languages", (id: "languages", title: L("languages"), kind: "pairs", items: langs)) }

  let interests = section-list(d, "interests").map(i => (
    label: pick(i, "name"), value: pick-list(i, "keywords").join(", ", default: ""),
  )).filter(p => p.label != "" or p.value != "")
  if interests.len() > 0 { sections.insert("interests", (id: "interests", title: L("interests"), kind: "pairs", items: interests)) }

  let refs = section-list(d, "references").map(r => entry(
    title: pick(r, "name"), summary: pick(r, "reference"),
  )).filter(e => e.title != "" or e.summary != "")
  if refs.len() > 0 { sections.insert("references", (id: "references", title: L("references"), kind: "entries", items: refs)) }

  // Custom sections: `customSections` / `custom_sections` / `meta.customSections`.
  let customs = section-list(d, "customSections", "custom_sections")
  if customs.len() == 0 { customs = section-list(D(d.at("meta", default: none)), "customSections") }
  let i = 0
  for c in customs {
    let title = pick(c, "title", "name")
    let items = A(c.at("entries", default: c.at("items", default: ()))).map(D).map(x => entry(
      title: pick(x, "title", "name"),
      org: pick(x, "subtitle", "organization"),
      date: if has(x.at("date", default: none)) { fmt-date(x.date, labels: labels) }
            else { date-range(pick(x, "startDate"), pick(x, "endDate"), open: false, labels: labels) },
      location: pick(x, "location"),
      url: pick(x, "url"),
      summary: pick(x, "description", "summary"),
      bullets: pick-list(x, "highlights", "bullets"),
    )).filter(e => e.title != "" or e.summary != "" or e.bullets.len() > 0)
    if title != "" and items.len() > 0 {
      let id = "custom-" + str(i)
      sections.insert(id, (id: id, title: title, kind: "entries", items: items))
    }
    i += 1
  }
  sections
}

#let default-order = ("summary", "skills", "experience", "education", "projects",
                      "certificates", "awards", "publications", "volunteer",
                      "languages", "interests", "custom", "references")

#let canonical-id(s) = {
  let s = lower(S(s))
  if s == "work" { "experience" } else if s == "certifications" { "certificates" } else if s == "customsections" { "custom" } else { s }
}

// Ordered list of section ids to render: meta.sectionOrder first, then any
// remaining non-hidden sections that have data, in `fallback` order.
#let resolve-order(meta, sections, fallback: default-order) = {
  let meta = D(meta)
  let hidden = A(meta.at("hiddenSections", default: ())).map(canonical-id)
  let custom-ids = sections.keys().filter(k => k.starts-with("custom-"))
  let expand(id) = if id == "custom" { custom-ids } else { (id,) }
  let order = ()
  for id in A(meta.at("sectionOrder", default: ())).map(canonical-id) + fallback {
    for x in expand(id) {
      if x not in order and x not in hidden and x in sections { order.push(x) }
    }
  }
  for k in custom-ids { if k not in order { order.push(k) } }
  order
}

// One call for templates: returns (basics, sections, order, labels).
#let load-resume(fallback-order: default-order) = {
  let d = load-data()
  let meta = D(d.at("meta", default: none))
  let labels = default-labels + D(meta.at("labels", default: none))
  let sections = build-sections(d, labels)
  (
    basics: normalize-basics(d, labels: labels),
    sections: sections,
    order: resolve-order(meta, sections, fallback: fallback-order),
    labels: labels,
    lang: if has(meta.at("lang", default: none)) { lower(S(meta.lang)) } else { "en" },
  )
}

// ------------------------------------------------------------ helpers ---

// Bullet list built from blocks so spacing stays even when split across pages.
#let bullet-list(items, marker: [•], indent: 0.9em, gap: 0.35em, body-indent: 0pt) = {
  for it in items {
    block(above: gap, below: gap, breakable: true, pad(left: body-indent,
      grid(columns: (indent, 1fr), column-gutter: 0pt, marker, it)))
  }
}

// Join inline items with `sep`, wrapping only *between* items so a line never
// ends with a dangling separator. Items are kept unbreakable.
#let wrap-join(items, sep) = layout(size => {
  let items = items.map(it => box(it))
  let sw = measure(sep).width
  let lines = ()
  let cur = ()
  let curw = 0pt
  for it in items {
    let w = measure(it).width
    if cur.len() > 0 and curw + sw + w > size.width {
      lines.push(cur)
      cur = ()
      curw = 0pt
    }
    curw += (if cur.len() > 0 { sw } else { 0pt }) + w
    cur.push(it)
  }
  if cur.len() > 0 { lines.push(cur) }
  lines.map(l => l.join(sep)).join(linebreak())
})

// "Name · 2 / 3" footer, only when the document has more than one page.
#let page-footer(name, fill: rgb("#666666"), size: 8pt, align-to: center) = context {
  let total = counter(page).final().first()
  if total > 1 {
    set text(size: size, fill: fill)
    align(align-to, {
      if name != "" { name; h(0.4em); [·]; h(0.4em) }
      counter(page).display()
      " / "
      str(total)
    })
  }
}

// Generic section dispatcher. `theme` provides:
//   heading(title)            -> content
//   text(str)                 -> content
//   entries(items, id)        -> content
//   pairs(items, id)          -> content
#let render-sections(r, theme) = {
  for id in r.order {
    let s = r.sections.at(id)
    let body = if s.kind == "text" { (theme.text)(s.items) }
      else if s.kind == "pairs" { (theme.pairs)(s.items, id) }
      else { (theme.entries)(s.items, id) }
    (theme.section)(s.title, body, id)
  }
}

// --------------------------------------------------------- cover letter ---

#let load-cover-letter() = {
  let d = load-data()
  let b = normalize-basics(d)
  let r = D(d.at("recipient", default: none))
  let address = r.at("address", default: none)
  let address-lines = if type(address) == array { address.map(S).filter(s => s != "") }
    else if has(address) { S(address).split("\n").map(s => s.trim()).filter(s => s != "") }
    else { () }
  let paragraphs = pick-list(d, "paragraphs")
  if paragraphs.len() == 0 and has(d.at("content", default: none)) {
    // Plain-text letter (cover_letters.content): split on blank lines.
    paragraphs = S(d.content).split(regex("\n\s*\n")).map(s => s.trim()).filter(s => s != "")
  }
  let date = S(d.at("date", default: none))
  if date.match(regex("^\d{4}-\d{2}-\d{2}$")) != none {
    let p = date.split("-")
    date = datetime(year: int(p.at(0)), month: int(p.at(1)), day: int(p.at(2))).display("[month repr:long] [day padding:none], [year]")
  }
  let closing = pick(d, "closing")
  (
    basics: b,
    closing: closing,
    // Signature defaults to the sender's name, but only under an explicit
    // closing (plain-text letters usually carry their own sign-off).
    signature: if has(d.at("signature", default: none)) { S(d.signature) } else if closing != "" { b.name } else { "" },
    recipient: (
      name: pick(r, "name"),
      title: pick(r, "title", "position"),
      company: pick(r, "company", "organization"),
      address: address-lines,
    ),
    date: date,
    subject: pick(d, "subject", "re"),
    salutation: pick(d, "salutation"),
    paragraphs: paragraphs,
  )
}
