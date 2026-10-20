// ats-classic — single-column, Jake's-resume inspired, maximally ATS friendly.
#import "../_lib/data.typ": *

#let r = load-resume()
#let b = r.basics
#let accent = accent-color("#111111")
#let muted = rgb("#3a3a3a")

#set document(title: if b.name != "" { b.name + " – Resume" } else { "Resume" }, author: b.name)
#set page(
  paper: paper-size(),
  margin: (x: 0.6in, top: 0.5in, bottom: 0.55in),
  footer: page-footer(b.name, fill: muted),
)
#set text(font: "Source Serif 4", size: 10.5pt, lang: r.lang, hyphenate: false, fill: rgb("#111111"))
#set par(justify: false, leading: 0.52em, spacing: 0.6em)

#show heading.where(level: 1): it => block(above: 13pt, below: 7pt, sticky: true, width: 100%,
  stroke: (bottom: 0.6pt + accent), inset: (bottom: 3pt),
  text(size: 11.5pt, weight: "semibold", fill: accent, tracking: 0.04em, smallcaps(it.body)))

// ------------------------------------------------------------------ header
#align(center, {
  if b.name != "" { block(below: 5pt, text(size: 22pt, weight: "bold", tracking: 0.02em, smallcaps(b.name))) }
  if b.label != "" { block(below: 5pt, text(size: 11pt, style: "italic", b.label)) }
  let items = contact-items(b)
  if items.len() > 0 {
    set text(size: 9.5pt)
    wrap-join(items.map(i => if i.url != none { link(i.url, i.text) } else { i.text }), [#h(0.45em)|#h(0.45em)])
  }
})
#v(2pt)

// ----------------------------------------------------------------- entries
#let row(left, right) = grid(columns: (1fr, auto), column-gutter: 1em, left, right)

#let entry-block(e, id) = {
  // Jake's layout: bold primary + date / italic secondary + location.
  let (primary, secondary) = if id == "education" { (e.org, e.title) } else { (e.title, e.org) }
  if primary == "" { primary = secondary; secondary = "" }
  let one-line = id in ("certificates", "awards", "publications", "references")
  let first = {
    strong(primary)
    if e.tags.len() > 0 { [ #h(0.3em)|#h(0.3em) ] + emph(e.tags.join(", ")) }
    if one-line and secondary != "" { [, ] + emph(secondary) }
    if e.url != "" and id in ("projects", "publications", "certificates") and safe-url(e.url) != none {
      [ #h(0.3em)|#h(0.3em) ] + text(size: 9.5pt, link(safe-url(e.url), pretty-url(e.url)))
    }
  }
  block(above: 1.05em, below: 0pt, sticky: e.summary != "" or e.bullets.len() > 0, {
    if one-line {
      row(first, e.date)
    } else {
      row(first, e.date)
      if secondary != "" or e.location != "" {
        block(above: 0.5em, row(emph(secondary), emph(e.location)))
      }
    }
  })
  if e.summary != "" { block(above: 0.55em, below: 0pt, e.summary) }
  if e.bullets.len() > 0 {
    block(above: 0.6em, below: 0pt, {
      set text(size: 10pt)
      bullet-list(e.bullets, marker: [•], indent: 1em, gap: 0.6em, body-indent: 0.5em)
    })
  }
}

#let theme = (
  section: (title, body, id) => { heading(level: 1, title); body },
  text: s => block(above: 0pt, s),
  entries: (items, id) => for e in items { entry-block(e, id) },
  pairs: (items, id) => {
    if id == "languages" {
      items.map(p => if p.value != "" { strong(p.label) + [ (#p.value)] } else { strong(p.label) }).join(", ")
    } else {
      for p in items {
        block(above: 0.55em, below: 0pt, if p.label != "" { strong(p.label) + [: ] + p.value } else { p.value })
      }
    }
  },
)

#render-sections(r, theme)
