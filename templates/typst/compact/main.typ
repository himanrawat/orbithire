// compact — dense one-page layout for experienced candidates.
#import "../_lib/data.typ": *

#let r = load-resume()
#let b = r.basics
#let accent = accent-color("#0f6b5c")
#let ink = rgb("#1c1c1c")
#let muted = rgb("#5e6366")

#set document(title: if b.name != "" { b.name + " – Resume" } else { "Resume" }, author: b.name)
#set page(
  paper: paper-size(),
  margin: (x: 0.5in, top: 0.42in, bottom: 0.45in),
  footer: page-footer(b.name, fill: muted, size: 7pt),
  footer-descent: 40%,
)
#set text(font: "Lato", size: 9.2pt, lang: r.lang, hyphenate: false, fill: ink)
#set par(justify: false, leading: 0.5em, spacing: 0.55em)

#show heading.where(level: 1): it => block(above: 11pt, below: 6pt, sticky: true, width: 100%,
  stroke: (bottom: 0.5pt + accent.lighten(55%)), inset: (bottom: 3pt),
  text(size: 9pt, weight: "black", fill: accent, tracking: 0.1em, upper(it.body)))

// ------------------------------------------------------------------ header
#{
  let items = contact-items(b)
  grid(columns: (1fr, auto), column-gutter: 1.5em, align: (left + bottom, right + bottom),
    {
      if b.name != "" { block(below: 4pt, text(size: 19pt, weight: "black", fill: ink, b.name)) }
      if b.label != "" { text(size: 10pt, fill: accent, weight: "bold", b.label) }
    },
    if items.len() > 0 {
      set text(size: 8.3pt, fill: muted)
      set par(leading: 0.42em)
      // Two items per line, right-aligned, keeps the header short.
      let parts = items.map(i => if i.url != none { link(i.url, i.text) } else { i.text })
      block(width: 4in, align(right, wrap-join(parts, [#h(0.4em)#text(fill: accent)[•]#h(0.4em)])))
    },
  )
  v(2pt)
}

// ----------------------------------------------------------------- entries
#let sep = [#h(0.3em)#text(fill: muted)[|]#h(0.3em)]

#let entry-block(e, id) = {
  let (primary, secondary) = if id == "education" { (e.org, e.title) } else { (e.title, e.org) }
  if primary == "" { primary = secondary; secondary = "" }
  block(above: 0.72em, below: 0pt, sticky: e.summary != "" or e.bullets.len() > 0,
    grid(columns: (1fr, auto), column-gutter: 1em,
      {
        text(weight: "bold", primary)
        if secondary != "" { [, ] + text(style: "italic", secondary) }
        if e.location != "" { text(fill: muted)[ — #e.location] }
        if e.tags.len() > 0 { sep + text(fill: muted, e.tags.join(", ")) }
        if e.url != "" and safe-url(e.url) != none and id != "experience" {
          sep + text(fill: muted, link(safe-url(e.url), pretty-url(e.url)))
        }
      },
      text(fill: muted, size: 8.6pt, e.date)))
  if e.summary != "" { block(above: 0.45em, below: 0pt, e.summary) }
  if e.bullets.len() > 0 {
    block(above: 0.45em, below: 0pt,
      bullet-list(e.bullets, marker: text(fill: accent)[•], indent: 0.85em, gap: 0.45em, body-indent: 0.15em))
  }
}

#let theme = (
  section: (title, body, id) => { heading(level: 1, title); body },
  text: s => block(above: 0pt, s),
  entries: (items, id) => for e in items { entry-block(e, id) },
  pairs: (items, id) => {
    if id in ("languages", "interests") {
      items.map(p => if p.value != "" and p.label != "" { text(weight: "bold", p.label) + [ (#p.value)] } else { p.label + p.value }).join(", ")
    } else {
      for p in items {
        block(above: 0.45em, below: 0pt, if p.label != "" { text(weight: "bold", p.label) + [: ] + p.value } else { p.value })
      }
    }
  },
)

#render-sections(r, theme)
