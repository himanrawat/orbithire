// moderncv — port of the LaTeX moderncv "banking" style (sans, blue) used by
// ai-job-search: centred name, centred contact lines, accent section titles
// over a full-width rule, hollow-circle entry markers, organisation in bold
// with the role in italics and the dates flush right.
#import "../_lib/data.typ": *

#let r = load-resume()
#let b = r.basics
#let accent = accent-color("#3873b3") // moderncv "blue" (color1)
#let ink = rgb("#000000")
#let muted = rgb("#5d5d5d")
#let rule = rgb("#000000")

#set document(title: if b.name != "" { b.name + " – CV" } else { "CV" }, author: b.name)
#set page(
  paper: paper-size(),
  margin: (x: 24mm, top: 20mm, bottom: 22mm),
  footer: context {
    let total = counter(page).final().first()
    if total > 1 {
      align(right, text(size: 8.5pt, fill: muted, style: "italic",
        counter(page).display() + "/" + str(total)))
    }
  },
)
#set text(font: "Latin Modern Sans", size: 9.8pt, lang: r.lang, hyphenate: false, fill: ink)
#set par(justify: true, leading: 0.5em, spacing: 0.6em)
#show link: set text(fill: accent)

#show heading.where(level: 1): it => block(above: 15pt, below: 8pt, sticky: true, width: 100%,
  stack(dir: ttb, spacing: 4pt,
    text(size: 13.5pt, weight: "bold", fill: accent, it.body),
    line(length: 100%, stroke: 0.6pt + rule)))

// ------------------------------------------------------------------ header
#align(center, {
  if b.name != "" {
    block(below: 6pt, text(size: 30pt, weight: "bold", fill: accent, tracking: 0.01em, b.name))
  }
  if b.label != "" { block(above: 0pt, below: 6pt, text(size: 12pt, style: "italic", fill: muted, b.label)) }
  set text(size: 9.2pt)
  set par(leading: 0.45em)
  let dot = [#h(0.6em)#text(fill: muted, size: 0.8em, baseline: -0.1em, font: "Inter")[•]#h(0.6em)]
  if b.location != "" { block(above: 0pt, below: 4pt, b.location) }
  let reach = ()
  if b.phone != "" { reach.push(link("tel:" + b.phone.replace(regex("[^0-9+]"), ""), b.phone)) }
  if b.email != "" { reach.push(link("mailto:" + b.email, b.email)) }
  if reach.len() > 0 { block(above: 0pt, below: 4pt, reach.join(dot)) }
  let web = ()
  if b.url != "" and safe-url(b.url) != none { web.push(link(safe-url(b.url), pretty-url(b.url))) }
  for p in b.profiles {
    let shown = if p.url != "" { pretty-url(p.url) } else { join-nonempty((p.network, p.username), ": ") }
    web.push(if safe-url(p.url) != none { link(safe-url(p.url), shown) } else { shown })
  }
  if web.len() > 0 { block(above: 0pt, below: 0pt, wrap-join(web, [, ])) }
})
#v(6pt)

// ----------------------------------------------------------------- entries
// Hollow accent circle, like moderncv's itemize marker.
#let marker = box(baseline: -0.12em, circle(radius: 2.4pt, stroke: 0.55pt + accent))
#let item(body, above: 0.5em) = block(above: above, below: 0pt,
  grid(columns: (11pt, 1fr), column-gutter: 0pt, align: (left + top, left + top),
    box(height: 0.7em, align(horizon, marker)), body))
#let dash-list(items) = bullet-list(items, marker: text(fill: accent)[–], indent: 0.95em, gap: 0.38em, body-indent: 11pt)

#let entry-block(e, id) = {
  // moderncv banking: organisation (bold) on the first line, the role in
  // italics on the second with the dates flush right.
  let (strong-line, role) = if e.org != "" and e.title != "" { (e.org, e.title) }
    else if e.org != "" { (e.org, "") } else { (e.title, "") }
  if id in ("projects", "certificates", "awards", "publications", "references") { (strong-line, role) = (e.title, e.org) }
  let extras = ()
  if e.location != "" { extras.push(e.location) }
  let has-body = e.summary != "" or e.bullets.len() > 0
  let header = {
    let first = text(weight: "bold", strong-line)
    if e.tags.len() > 0 { first += text(fill: muted, size: 8.8pt)[ #h(0.2em)·#h(0.2em) #e.tags.join(", ")] }
    if e.url != "" and safe-url(e.url) != none and id not in ("experience",) {
      first += text(size: 8.8pt)[ #h(0.3em) #link(safe-url(e.url), pretty-url(e.url))]
    }
    let second = (role, ..extras).filter(s => s != "").join(", ", default: "")
    if second == "" and e.date == "" {
      block(below: 0pt, first)
    } else if second == "" {
      grid(columns: (1fr, auto), column-gutter: 1em, first, text(style: "italic", e.date))
    } else {
      block(below: 0pt, first)
      block(above: 0.42em, below: 0pt,
        grid(columns: (1fr, auto), column-gutter: 1em,
          text(style: "italic", second), text(style: "italic", e.date)))
    }
  }
  block(above: 0.85em, below: 0pt, sticky: has-body, breakable: false, item(header, above: 0pt))
  if e.summary != "" { block(above: 0.45em, below: 0pt, pad(left: 11pt, e.summary)) }
  if e.bullets.len() > 0 { block(above: 0.42em, below: 0pt, dash-list(e.bullets)) }
}

#let theme = (
  section: (title, body, id) => { heading(level: 1, title); body },
  text: s => block(above: 0pt, s),
  entries: (items, id) => for e in items { entry-block(e, id) },
  pairs: (items, id) => {
    if id == "languages" {
      item(above: 0pt, items.map(p => if p.value != "" { p.label + " (" + lower(p.value) + ")" } else { p.label }).join(", ") + ".")
    } else {
      for (i, p) in items.enumerate() {
        item(above: if i == 0 { 0pt } else { 0.42em },
          if p.label != "" and p.value != "" { text(weight: "bold", p.label) + [: ] + p.value }
          else { text(weight: if p.value == "" { "bold" } else { "regular" }, p.label + p.value) })
      }
    }
  },
)

#render-sections(r, theme)
