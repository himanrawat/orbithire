// modern — sans-serif, accent-colour header band, clean single column.
#import "../_lib/data.typ": *

#let r = load-resume()
#let b = r.basics
#let accent = accent-color("#1f4e79")
#let ink = rgb("#1f2933")
#let muted = rgb("#5b6673")
#let rule = rgb("#d9dee4")
#let mx = 0.65in
#let mt = 0.55in

#set document(title: if b.name != "" { b.name + " – Resume" } else { "Resume" }, author: b.name)
#set page(
  paper: paper-size(),
  margin: (x: mx, top: mt, bottom: 0.6in),
  footer: page-footer(b.name, fill: muted, align-to: right),
)
#set text(font: "Inter", size: 9.6pt, lang: r.lang, hyphenate: false, fill: ink)
#set par(justify: false, leading: 0.6em, spacing: 0.7em)

#show heading.where(level: 1): it => block(above: 15pt, below: 8pt, sticky: true, width: 100%,
  grid(columns: (auto, 1fr), column-gutter: 8pt, align: horizon,
    text(size: 9.5pt, weight: "bold", fill: accent, tracking: 0.09em, upper(it.body)),
    line(length: 100%, stroke: 0.7pt + rule)))

// ------------------------------------------------------------------ header
#block(width: 100%, fill: accent, outset: (x: mx, top: mt), inset: (top: 2pt, bottom: 18pt), below: 4pt, {
  set text(fill: white)
  if b.name != "" { block(below: 7pt, text(size: 25pt, weight: "bold", tracking: -0.01em, b.name)) }
  if b.label != "" { block(below: 9pt, text(size: 11.5pt, weight: "medium", fill: white.transparentize(10%), b.label)) }
  let items = contact-items(b)
  if items.len() > 0 {
    set text(size: 8.8pt, fill: white.transparentize(8%))
    wrap-join(items.map(i => if i.url != none { link(i.url, i.text) } else { i.text }),
      [#h(0.55em)#text(fill: white.transparentize(45%))[|]#h(0.55em)])
  }
})

// ----------------------------------------------------------------- entries
#let entry-block(e, id) = {
  let (primary, secondary) = if id == "education" { (e.title, e.org) } else { (e.title, e.org) }
  if primary == "" { primary = secondary; secondary = "" }
  let compact = id in ("certificates", "awards", "publications", "references")
  block(above: if compact { 0.75em } else { 1.15em }, below: 0pt, sticky: e.summary != "" or e.bullets.len() > 0, {
    grid(columns: (1fr, auto), column-gutter: 1em,
      {
        text(weight: "semibold", size: 10.2pt, primary)
        if compact and secondary != "" { text(fill: muted)[ #h(0.2em)·#h(0.2em) #secondary] }
        if e.tags.len() > 0 { text(fill: muted, size: 8.8pt)[ #h(0.3em)·#h(0.3em) #e.tags.join(", ")] }
      },
      text(fill: muted, size: 8.8pt, e.date))
    let sub = ()
    if not compact and secondary != "" { sub.push(text(fill: accent, weight: "medium", secondary)) }
    if e.location != "" { sub.push(text(fill: muted, e.location)) }
    if e.url != "" and safe-url(e.url) != none and id != "experience" {
      sub.push(text(fill: muted, size: 8.8pt, link(safe-url(e.url), pretty-url(e.url))))
    }
    if sub.len() > 0 { block(above: 0.5em, sub.join([#h(0.35em)#text(fill: muted)[·]#h(0.35em)])) }
  })
  if e.summary != "" { block(above: 0.6em, below: 0pt, text(fill: ink.lighten(10%), e.summary)) }
  if e.bullets.len() > 0 {
    block(above: 0.6em, below: 0pt,
      bullet-list(e.bullets, marker: text(fill: accent, weight: "bold")[•], indent: 1em, gap: 0.62em))
  }
}

#let theme = (
  section: (title, body, id) => { heading(level: 1, title); body },
  text: s => block(above: 0pt, s),
  entries: (items, id) => for e in items { entry-block(e, id) },
  pairs: (items, id) => {
    if id == "languages" or items.all(p => p.label == "" or p.value == "") {
      items.map(p => if p.value != "" and p.label != "" { text(weight: "semibold", p.label) + text(fill: muted)[ (#p.value)] } else { p.label + p.value })
        .join([#h(0.5em)#text(fill: rule)[|]#h(0.5em)])
    } else {
      grid(columns: (auto, 1fr), column-gutter: 1.2em, row-gutter: 0.62em,
        ..items.map(p => (text(weight: "semibold", p.label), p.value)).flatten())
    }
  },
)

#render-sections(r, theme)
