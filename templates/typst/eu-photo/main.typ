// eu-photo — DE/EU style CV ("Lebenslauf"): photo slot, personal-details
// table and a date column on the left of every entry.
#import "../_lib/data.typ": *

#let r = load-resume()
#let b = r.basics
#let accent = accent-color("#8c2f39")
#let ink = rgb("#222222")
#let muted = rgb("#666b70")
#let rule = rgb("#dcdcdc")
#let photo = photo-path()
#let date-col = 31mm
#let gutter = 6mm

#set document(title: if b.name != "" { b.name + " – CV" } else { "CV" }, author: b.name)
#set page(
  paper: paper-size(),
  margin: (x: 18mm, top: 16mm, bottom: 17mm),
  footer: page-footer(b.name, fill: muted, align-to: right),
)
#set text(font: "Lato", size: 9.6pt, lang: r.lang, hyphenate: false, fill: ink)
#set par(justify: false, leading: 0.58em, spacing: 0.65em)

#show heading.where(level: 1): it => block(above: 15pt, below: 8pt, sticky: true, width: 100%,
  stroke: (bottom: 0.6pt + rule), inset: (bottom: 4pt),
  text(font: "Source Serif 4", size: 12.5pt, weight: "semibold", fill: accent, it.body))

// ------------------------------------------------------------------ header
#let detail-rows = {
  let rows = ()
  if b.address != "" { rows.push((r.labels.address, b.address)) }
  if b.phone != "" { rows.push((r.labels.phone, link("tel:" + b.phone.replace(regex("[^0-9+]"), ""), b.phone))) }
  if b.email != "" { rows.push((r.labels.email, link("mailto:" + b.email, b.email))) }
  if b.url != "" and safe-url(b.url) != none { rows.push((r.labels.website, link(safe-url(b.url), pretty-url(b.url)))) }
  for p in b.profiles {
    let label = if p.network != "" { p.network } else { "Profile" }
    let shown = if p.url != "" { pretty-url(p.url) } else { p.username }
    rows.push((label, if safe-url(p.url) != none { link(safe-url(p.url), shown) } else { shown }))
  }
  for d in b.details { rows.push((d.label, d.value)) }
  rows
}

#let header-text = {
  if b.name != "" { block(below: 5pt, text(font: "Source Serif 4", size: 25pt, weight: "semibold", fill: ink, b.name)) }
  if b.label != "" { block(below: 10pt, text(size: 11.5pt, fill: accent, weight: "bold", tracking: 0.02em, b.label)) }
  if detail-rows.len() > 0 {
    set text(size: 9pt)
    grid(columns: (auto, 1fr), column-gutter: 10pt, row-gutter: 0.55em,
      ..detail-rows.map(((k, v)) => (text(fill: muted, k), v)).flatten())
  }
}

#if photo != none {
  grid(columns: (1fr, 32mm), column-gutter: 8mm, align: (left + top, right + top),
    header-text,
    box(clip: true, radius: 3pt, stroke: 0.5pt + rule,
      image(photo, width: 32mm, height: 40mm, fit: "cover")))
} else {
  header-text
}
#v(4pt)

// ----------------------------------------------------------------- entries
#let timeline(left, right, above: 0.95em, sticky: false) = block(above: above, below: 0pt, sticky: sticky,
  grid(columns: (date-col, 1fr), column-gutter: gutter, text(size: 8.8pt, fill: muted, left), right))

#let entry-block(e, id) = {
  let (primary, secondary) = if id == "education" { (e.title, e.org) } else { (e.title, e.org) }
  if primary == "" { primary = secondary; secondary = "" }
  let compact = id in ("certificates", "awards", "publications", "references")
  timeline(e.date, above: if compact { 0.7em } else { 1.05em }, {
    text(weight: "bold", primary)
    if compact and secondary != "" { text(fill: muted)[, #secondary] }
    if e.tags.len() > 0 { text(fill: muted, size: 8.8pt)[ #h(0.2em)·#h(0.2em) #e.tags.join(", ")] }
    let sub = ()
    if not compact and secondary != "" { sub.push(text(fill: accent, secondary)) }
    if e.location != "" { sub.push(text(fill: muted, e.location)) }
    if e.url != "" and safe-url(e.url) != none and id != "experience" {
      sub.push(text(fill: muted, size: 8.8pt, link(safe-url(e.url), pretty-url(e.url))))
    }
    if sub.len() > 0 { block(above: 0.5em, below: 0pt, sub.join([, ])) }
    if e.summary != "" { block(above: 0.55em, below: 0pt, e.summary) }
    if e.bullets.len() > 0 {
      block(above: 0.55em, below: 0pt,
        bullet-list(e.bullets, marker: text(fill: accent)[–], indent: 0.9em, gap: 0.55em))
    }
  })
}

#let theme = (
  section: (title, body, id) => { heading(level: 1, title); body },
  text: s => block(above: 0pt, s),
  entries: (items, id) => for e in items { entry-block(e, id) },
  pairs: (items, id) => {
    for p in items {
      if p.label != "" { timeline(p.label, p.value, above: 0.6em) } else { timeline("", p.value, above: 0.6em) }
    }
  },
)

#render-sections(r, theme)
