// cover-moderncv — port of ai-job-search's cover.cls: a light Lato name
// centred over a grey Raleway contact line, the date flush right and an airy
// Raleway Medium body. Pairs with moderncv.
#import "../_lib/data.typ": *

#let l = load-cover-letter()
#let b = l.basics
#let accent = accent-color("#2b2b2b") // name + company colour
#let ink = rgb("#2b2b2b")             // cover.cls "primary"
#let headings = rgb("#6a6a6a")        // cover.cls "headings"
#let sub = rgb("#333333")             // cover.cls "subheadings"
#let body-font = "Raleway"

#set document(title: if b.name != "" { b.name + " – Cover Letter" } else { "Cover Letter" }, author: b.name)
#set page(
  paper: paper-size(),
  margin: (x: 23mm, top: 20mm, bottom: 23mm),
  footer: context {
    let total = counter(page).final().first()
    if total > 1 {
      align(right, text(font: body-font, weight: "medium", size: 8.5pt, fill: headings,
        "Page " + counter(page).display()))
    }
  },
)
#set text(font: body-font, weight: "medium", size: 10.6pt, hyphenate: false, fill: ink, number-type: "lining")
#set par(justify: false, leading: 0.62em, spacing: 1.25em)
#show link: set text(fill: headings)

// ------------------------------------------------------------------ header
#align(center, {
  if b.name != "" {
    block(below: 9pt, text(font: "Lato", weight: "light", size: 34pt, fill: accent, tracking: 0.01em, b.name))
  }
  let items = contact-items(b)
  if b.label != "" { block(above: 0pt, below: 5pt, text(size: 10.5pt, fill: sub, b.label)) }
  if items.len() > 0 {
    set text(size: 9.8pt, fill: headings)
    wrap-join(items.map(i => if i.url != none { link(i.url, i.text) } else { i.text }),
      [#h(0.45em)|#h(0.45em)])
  }
})
#v(14pt)

// -------------------------------------------------------------------- body
#if l.date != "" { align(right, block(below: 14pt, l.date)) }

#{
  // cover.cls \companyname (Lato Bold) then \companyaddress (Raleway).
  let rc = l.recipient
  let lines = (rc.name, rc.title, rc.company).filter(s => s != "") + rc.address
  if lines.len() > 0 {
    block(below: 18pt, {
      for (i, line) in lines.enumerate() {
        block(above: if i == 0 { 0pt } else { 0.45em }, below: 0pt,
          if i == 0 { text(font: "Lato", weight: "bold", size: 11.5pt, fill: accent, line) } else { line })
      }
    })
  }
}

#if l.subject != "" { block(below: 14pt, text(font: "Lato", weight: "bold", size: 11pt, fill: sub, l.subject)) }
#if l.salutation != "" { block(below: 1.25em, l.salutation) }

#for p in l.paragraphs { par(p) }

#if l.closing != "" or l.signature != "" {
  block(above: 1.6em, breakable: false, {
    if l.closing != "" { l.closing }
    if l.signature != "" {
      v(2.2em)
      text(fill: ink, l.signature)
    }
  })
}
