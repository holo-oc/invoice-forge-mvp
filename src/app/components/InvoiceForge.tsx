'use client';

import { useMemo, useRef, useState } from 'react';

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type Invoice = {
  fromName: string;
  fromAddress: string;
  billToName: string;
  billToAddress: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  currency: string;
  taxRatePct: number;
  notes: string;
  items: LineItem[];
};

const STORAGE_KEY = 'invoiceForge:last:v1';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid / Intl missing.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function base64UrlEncodeUtf8(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecodeUtf8(input: string) {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const exampleInvoice: Invoice = {
  fromName: 'Acme Studio LLC',
  fromAddress: '1-2-3 Shibuya\nTokyo, Japan',
  billToName: 'Client Co.',
  billToAddress: '500 Market St\nSan Francisco, CA',
  invoiceNumber: 'INV-1007',
  issueDate: todayISO(),
  dueDate: plusDaysISO(14),
  currency: 'USD',
  taxRatePct: 10,
  notes: 'Thank you for your business. Please include the invoice number on your payment reference.',
  items: [
    { id: uid(), description: 'Landing page design (Figma)', quantity: 1, unitPrice: 900 },
    { id: uid(), description: 'Implementation (Next.js)', quantity: 10, unitPrice: 90 },
  ],
};

function normalizeInvoice(input: Partial<Invoice>): Invoice {
  return {
    fromName: input.fromName ?? '',
    fromAddress: input.fromAddress ?? '',
    billToName: input.billToName ?? '',
    billToAddress: input.billToAddress ?? '',
    invoiceNumber: input.invoiceNumber ?? '',
    issueDate: input.issueDate ?? todayISO(),
    dueDate: input.dueDate ?? plusDaysISO(14),
    currency: input.currency ?? 'USD',
    taxRatePct: typeof input.taxRatePct === 'number' ? input.taxRatePct : 0,
    notes: input.notes ?? '',
    items: Array.isArray(input.items)
      ? input.items.map((it) => ({
          id: typeof it?.id === 'string' ? it.id : uid(),
          description: typeof it?.description === 'string' ? it.description : '',
          quantity: typeof it?.quantity === 'number' ? it.quantity : 1,
          unitPrice: typeof it?.unitPrice === 'number' ? it.unitPrice : 0,
        }))
      : [{ id: uid(), description: 'Service', quantity: 1, unitPrice: 0 }],
  };
}

function parseInvoiceFromUrl(): { invoice: Invoice; status: string } {
  if (typeof window === 'undefined') return { invoice: normalizeInvoice(exampleInvoice), status: '' };
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');
  if (!data) return { invoice: normalizeInvoice(exampleInvoice), status: '' };
  try {
    const json = base64UrlDecodeUtf8(data);
    const parsed = safeJsonParse<Partial<Invoice>>(json);
    if (!parsed) return { invoice: normalizeInvoice(exampleInvoice), status: '' };
    return { invoice: normalizeInvoice(parsed), status: 'Loaded invoice from share link.' };
  } catch {
    return { invoice: normalizeInvoice(exampleInvoice), status: '' };
  }
}

export function InvoiceForge() {
  const init = parseInvoiceFromUrl();
  const [invoice, setInvoice] = useState<Invoice>(() => init.invoice);
  const [status, setStatus] = useState<string>(() => init.status);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const totals = useMemo(() => {
    const subtotal = round2(
      invoice.items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
    );
    const tax = round2((subtotal * (Number(invoice.taxRatePct) || 0)) / 100);
    const total = round2(subtotal + tax);
    return { subtotal, tax, total };
  }, [invoice.items, invoice.taxRatePct]);

  function update<K extends keyof Invoice>(key: K, value: Invoice[K]) {
    setInvoice((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  function addItem() {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), description: '', quantity: 1, unitPrice: 0 }],
    }));
  }

  function removeItem(id: string) {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.length <= 1 ? prev.items : prev.items.filter((it) => it.id !== id),
    }));
  }

  function loadExample() {
    setInvoice(normalizeInvoice(exampleInvoice));
    setStatus('Loaded example invoice.');
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoice));
    setStatus('Saved to this browser (localStorage).');
  }

  function loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus('No saved invoice found in this browser.');
      return;
    }
    const parsed = safeJsonParse<Partial<Invoice>>(raw);
    if (!parsed) {
      setStatus('Saved data was corrupted.');
      return;
    }
    setInvoice(normalizeInvoice(parsed));
    setStatus('Loaded saved invoice from this browser.');
  }

  async function copyShareLink() {
    const json = JSON.stringify(invoice);
    const data = base64UrlEncodeUtf8(json);
    const url = new URL(window.location.href);
    url.searchParams.set('data', data);

    await navigator.clipboard.writeText(url.toString());
    setStatus('Copied share link to clipboard.');
  }

  function printInvoice() {
    // Make sure preview is visible in print.
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => window.print(), 150);
  }

  return (
    <div className="shell">
      <header className="header">
        <div>
          <h1 className="title">InvoiceForge</h1>
          <p className="subtitle">A tiny, local-first invoice generator (print to PDF).</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={loadExample} type="button">
            Load example
          </button>
          <button className="btn" onClick={loadLocal} type="button">
            Load saved
          </button>
          <button className="btn" onClick={saveLocal} type="button">
            Save
          </button>
          <button className="btn primary" onClick={printInvoice} type="button">
            Print / Export PDF
          </button>
        </div>
      </header>

      {status ? <div className="status">{status}</div> : null}

      <div className="grid">
        <section className="panel no-print">
          <h2>Invoice details</h2>

          <div className="twoCol">
            <label>
              <span>From (your business)</span>
              <input value={invoice.fromName} onChange={(e) => update('fromName', e.target.value)} />
            </label>
            <label>
              <span>Invoice #</span>
              <input value={invoice.invoiceNumber} onChange={(e) => update('invoiceNumber', e.target.value)} />
            </label>

            <label>
              <span>Issue date</span>
              <input type="date" value={invoice.issueDate} onChange={(e) => update('issueDate', e.target.value)} />
            </label>
            <label>
              <span>Due date</span>
              <input type="date" value={invoice.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
            </label>

            <label>
              <span>Currency</span>
              <input value={invoice.currency} onChange={(e) => update('currency', e.target.value.toUpperCase())} />
            </label>
            <label>
              <span>Tax rate (%)</span>
              <input
                type="number"
                value={invoice.taxRatePct}
                onChange={(e) => update('taxRatePct', Number(e.target.value))}
                min={0}
                step={0.1}
              />
            </label>
          </div>

          <label>
            <span>From address</span>
            <textarea
              rows={3}
              value={invoice.fromAddress}
              onChange={(e) => update('fromAddress', e.target.value)}
              placeholder={'Street\nCity, Country'}
            />
          </label>

          <label>
            <span>Bill to</span>
            <input value={invoice.billToName} onChange={(e) => update('billToName', e.target.value)} />
          </label>

          <label>
            <span>Client address</span>
            <textarea
              rows={3}
              value={invoice.billToAddress}
              onChange={(e) => update('billToAddress', e.target.value)}
              placeholder={'Street\nCity, Country'}
            />
          </label>

          <h2 style={{ marginTop: 16 }}>Line items</h2>

          <div className="items">
            {invoice.items.map((it) => (
              <div className="itemRow" key={it.id}>
                <input
                  className="desc"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => updateItem(it.id, { description: e.target.value })}
                />
                <input
                  className="qty"
                  type="number"
                  min={0}
                  step={1}
                  value={it.quantity}
                  onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                />
                <input
                  className="price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={it.unitPrice}
                  onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) })}
                />
                <button className="btn danger" type="button" onClick={() => removeItem(it.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="itemFooter">
            <button className="btn" type="button" onClick={addItem}>
              + Add line item
            </button>
            <button className="btn" type="button" onClick={copyShareLink}>
              Copy share link
            </button>
          </div>

          <label>
            <span>Notes</span>
            <textarea rows={3} value={invoice.notes} onChange={(e) => update('notes', e.target.value)} />
          </label>

          <p className="hint">
            Tip: use <b>Print / Export PDF</b> and choose “Save as PDF”.
          </p>
        </section>

        <section className="panel preview" ref={previewRef}>
          <div className="invoice">
            <div className="invoiceTop">
              <div>
                <div className="invoiceTitle">INVOICE</div>
                <div className="muted">{invoice.invoiceNumber || '—'}</div>
              </div>
              <div className="meta">
                <div>
                  <div className="muted">Issue</div>
                  <div>{invoice.issueDate || '—'}</div>
                </div>
                <div>
                  <div className="muted">Due</div>
                  <div>{invoice.dueDate || '—'}</div>
                </div>
              </div>
            </div>

            <div className="addresses">
              <div>
                <div className="label">From</div>
                <div className="block">
                  <div className="strong">{invoice.fromName || '—'}</div>
                  <pre className="pre">{invoice.fromAddress || ''}</pre>
                </div>
              </div>
              <div>
                <div className="label">Bill to</div>
                <div className="block">
                  <div className="strong">{invoice.billToName || '—'}</div>
                  <pre className="pre">{invoice.billToAddress || ''}</pre>
                </div>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit</th>
                  <th className="num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it) => {
                  const lineTotal = round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
                  return (
                    <tr key={it.id}>
                      <td>{it.description || '—'}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">{formatMoney(it.unitPrice, invoice.currency)}</td>
                      <td className="num">{formatMoney(lineTotal, invoice.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="totals">
              <div className="row">
                <div className="muted">Subtotal</div>
                <div>{formatMoney(totals.subtotal, invoice.currency)}</div>
              </div>
              <div className="row">
                <div className="muted">Tax ({invoice.taxRatePct || 0}%)</div>
                <div>{formatMoney(totals.tax, invoice.currency)}</div>
              </div>
              <div className="row total">
                <div>Total</div>
                <div>{formatMoney(totals.total, invoice.currency)}</div>
              </div>
            </div>

            {invoice.notes ? (
              <div className="notes">
                <div className="label">Notes</div>
                <div className="noteBody">{invoice.notes}</div>
              </div>
            ) : null}

            <div className="footer muted">Generated with InvoiceForge (local-first). Printed via browser.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
