// cover-classic — serif letter that pairs with ats-classic.
#import "../_lib/data.typ": *
#import "../_lib/letter.typ": letter-body

#let l = load-cover-letter()
#let b = l.basics
#let accent = accent-color("#111111")
#let muted = rgb("#3a3a3a")

#set document(title: if b.name != "" { b.name + " – Cover Letter" } else { "Cover Letter" }, author: b.name)
#set page(paper: paper-size(), margin: (x: 1in, top: 0.75in, bottom: 0.9in), footer: page-footer(b.name, fill: muted))
#set text(font: "Source Serif 4", size: 11pt, hyphenate: false, fill: rgb("#111111"))
#set par(justify: false, leading: 0.68em, spacing: 1em)

// ------------------------------------------------------------------ header
#align(center, {
  if b.name != "" { block(below: 6pt, text(size: 21pt, weight: "bold", tracking: 0.02em, fill: accent, smallcaps(b.name))) }
  if b.label != "" { block(below: 6pt, text(size: 10.5pt, style: "italic", b.label)) }
  let items = contact-items(b)
  if items.len() > 0 {
    set text(size: 9.5pt)
    wrap-join(items.map(i => if i.url != none { link(i.url, i.text) } else { i.text }), [#h(0.45em)|#h(0.45em)])
  }
})
#block(above: 10pt, below: 26pt, line(length: 100%, stroke: 0.6pt + accent))

#letter-body(l, accent: accent, muted: muted)
