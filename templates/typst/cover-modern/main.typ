// cover-modern — sans-serif letter with accent header band; pairs with modern.
#import "../_lib/data.typ": *
#import "../_lib/letter.typ": letter-body

#let l = load-cover-letter()
#let b = l.basics
#let accent = accent-color("#1f4e79")
#let ink = rgb("#1f2933")
#let muted = rgb("#5b6673")
#let mx = 0.9in
#let mt = 0.55in

#set document(title: if b.name != "" { b.name + " – Cover Letter" } else { "Cover Letter" }, author: b.name)
#set page(paper: paper-size(), margin: (x: mx, top: mt, bottom: 0.85in), footer: page-footer(b.name, fill: muted, align-to: right))
#set text(font: "Inter", size: 10.2pt, hyphenate: false, fill: ink)
#set par(justify: false, leading: 0.72em, spacing: 1em)

// ------------------------------------------------------------------ header
#block(width: 100%, fill: accent, outset: (x: mx, top: mt), inset: (top: 4pt, bottom: 20pt), below: 34pt, {
  set text(fill: white)
  if b.name != "" { block(below: 7pt, text(size: 24pt, weight: "bold", tracking: -0.01em, b.name)) }
  if b.label != "" { block(below: 9pt, text(size: 11pt, weight: "medium", fill: white.transparentize(10%), b.label)) }
  let items = contact-items(b)
  if items.len() > 0 {
    set text(size: 8.8pt, fill: white.transparentize(8%))
    wrap-join(items.map(i => if i.url != none { link(i.url, i.text) } else { i.text }),
      [#h(0.55em)#text(fill: white.transparentize(45%))[|]#h(0.55em)])
  }
})

#letter-body(l, accent: accent, muted: muted)
