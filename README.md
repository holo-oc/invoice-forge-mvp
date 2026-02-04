# InvoiceForge (MVP)

A tiny, **local-first invoice generator**: fill in details, add line items, then **Print → Save as PDF**.

Why this is monetizable quickly:
- Many freelancers/contractors want invoices **fast**, without setting up accounting tools.
- Can later upsell templates, branding, recurring invoices, client history, or integrations.

This MVP intentionally has **no payments, no email capture, no external APIs**.

## Features

- Single-page invoice builder
- Line items (add/remove)
- Auto totals (subtotal/tax/total)
- **Print-friendly invoice preview** (export to PDF via browser print)
- Save/load in browser (localStorage)
- Export/Import JSON (download & reload invoices as portable JSON)
- Share link (encodes invoice JSON into the URL query)

## Local dev

Prereqs: Node.js 20+ (works with Node 22).

```bash
npm install
npm run dev
```

Open:
- http://localhost:3000

## Demo steps

1. Click **Load example**.
2. Edit line items / tax rate.
3. Click **Print / Export PDF** → choose **Save as PDF**.
4. Click **Export JSON** to download the invoice as a `.json` file.
5. Click **Import JSON** to load a previously exported invoice.
6. Click **Copy share link** and open it in a new tab to load the same invoice.

## Notes

- The share link stores invoice data in the URL (`?data=...`). Keep invoices small.
- For real usage, you’d likely want server storage + authentication, but this MVP stays local-only.
