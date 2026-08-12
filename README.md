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
index.html            markup (form, success screen, hidden certificate)
style.css             all styling
script.js             validation, Supabase insert, PDF generation
supabase-setup.sql    run once in the Supabase SQL editor
logo.png              AI Minds logo  (add this)
certificate-bg.png    optional certificate background (add this)
assets/               chatgpt.png gemini.png gamma.png yoodli.png mapify.png napkin.png
```

Missing images never break the page: tool logos fall back to a lettered blue
tile, and the header/certificate logos are simply hidden.

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
- The certificate is a real HTML block rendered off-screen at 1123 × 794 px
  (A4 landscape at 96 DPI), captured with html2canvas at 2× and placed into a
  jsPDF landscape A4 page. Edit the certificate wording in `index.html` and its
  look under the "Certificate" section of `style.css`.
- That same capture is shown as the on-screen preview, so the preview and the
  PDF can never drift apart, and repeat downloads reuse the cached image.
- Certificate numbers look like `AIM-2026-5F8D9A2C` (crypto random, unique
  index in the database) and are printed in the top-right of the certificate.
- Downloading is manual by design — the student sees the certificate first.
  The **Download Certificate (PDF)** button is always on the success screen, so
  a blocked or missed download can be retried.
