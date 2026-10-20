// Shared cover-letter body: date, recipient, subject, salutation,
// paragraphs, closing and signature. All values are plain strings.
#import "data.typ": *

#let letter-body(l, accent: black, muted: gray, date-align: left) = {
  if l.date != "" { align(date-align, block(below: 1.6em, text(fill: muted, l.date))) }

  let rc = l.recipient
  let lines = (rc.name, rc.title, rc.company).filter(s => s != "") + rc.address
  if lines.len() > 0 {
    block(below: 1.8em, {
      set par(spacing: 0.45em)
      for (i, line) in lines.enumerate() {
        block(above: 0.45em, below: 0pt, if i == 0 { strong(line) } else { line })
      }
    })
  }

  if l.subject != "" { block(below: 1.4em, text(weight: "bold", fill: accent, l.subject)) }
  if l.salutation != "" { block(below: 1.1em, l.salutation) }

  if l.paragraphs.len() > 0 {
    block(above: 0pt, below: 0pt, {
      set par(spacing: 1.05em)
      for p in l.paragraphs { par(p) }
    })
  }

  if l.closing != "" or l.signature != "" {
    block(above: 1.4em, breakable: false, {
      if l.closing != "" { l.closing }
      if l.signature != "" {
        v(2.4em)
        text(weight: "bold", l.signature)
      }
    })
  }
}
