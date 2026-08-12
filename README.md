# AI Minds — Session Feedback & Certificate

Static web app for the AI Career Guidance Session. A student fills the feedback
form, the response is saved to Supabase, and a personalised landscape A4
Certificate of Participation is generated, previewed on screen, and downloaded
as a PDF.

Flow: submit → *Saving Feedback…* → *Generating Certificate…* → tick animation
and confetti → certificate preview → download.

No login, no backend, no build step — just three files plus images.

## Files

```
index.html            markup (form, success screen, certificate preview)
style.css             all styling
script.js             validation, Supabase insert, certificate + PDF
supabase-setup.sql    run once in the Supabase SQL editor
logo.png              AI Minds logo shown in the page header (add this)
assets/certificate-template.png   finished certificate artwork (2000 x 1414)
assets/               chatgpt.png gemini.png gamma.png yoodli.png mapify.png napkin.png
```

Missing images never break the page: tool logos fall back to a lettered blue
tile and the header logo is simply hidden. The certificate template is the one
required image — without it the certificate reports an error instead of
producing broken artwork.

## Setup (2 steps)

**1. Create the table**

Supabase Dashboard → SQL Editor → New query → paste `supabase-setup.sql` → Run.

Re-run this file if you created the table earlier — it adds the
`certificate_number` and `submission_date` columns. (If you forget, the app
still saves the feedback without those two fields and logs a warning.)

**2. Add your credentials**

Supabase Dashboard → Project Settings → API. Copy the Project URL and the
`anon` public key into the top of `script.js`:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Then drop `logo.png` in the root and the six tool logos in `assets/`.

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Deploy by uploading the folder to Netlify, Vercel, GitHub Pages, or any static
host — no configuration needed.

## Viewing submissions

Supabase Dashboard → Table Editor → `feedback`. Use the export button for CSV.
The anon key can only insert rows, so nobody can read submissions from the
browser.

## Notes

- Contact fields use `inputmode="numeric"` with digit-only filtering rather than
  `<input type="number">` — this shows the numeric keypad on phones without the
  spinner arrows and scroll-wheel bugs that break phone entry.
- The certificate is `assets/certificate-template.png` drawn onto a canvas at
  its native resolution, with only the student name and date painted on top.
  All artwork (logo, headings, ribbon, seal, signature, borders) lives in the
  PNG — to change the design, replace the PNG.
- Text is positioned in the template design space (1492 x 1054, origin
  top-left) and the canvas scales that to the artwork's real pixel size, so the
  result is identical on phones, tablets and desktops.
- That one canvas image is both the on-screen preview and the image embedded in
  the PDF, so the two cannot drift apart.
- Downloading is manual by design — the student sees the certificate first.
  The **Download Certificate (PDF)** button is always on the success screen, so
  a blocked or missed download can be retried.
