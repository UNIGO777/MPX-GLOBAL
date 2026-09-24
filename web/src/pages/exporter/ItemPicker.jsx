import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { productsApi, productKeys } from '../../api/products.js';
import { minorToInput } from '../../lib/money.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';

/**
 * Pick a line for a quotation — from the exporter's own catalogue, or a blank
 * custom line.
 *
 * 🔴 BOTH routes exist on purpose. A quotation routinely carries lines that are
 * not listed products: the design's own sample prices "Water-repellent finish"
 * and "Lab-dip approval" alongside the fabric. A picker that only offered
 * catalogue rows would force those into the description of something else, or
 * out of the document entirely.
 *
 * 🔴 A picked product PRE-FILLS and nothing more. The exporter is quoting, not
 * re-listing: the rate, the quantity and the spec are all editable afterwards,
 * and the quotation stores its own copy. Changing the product later never
 * changes a quotation that was built from it.
 */
const BLANK = { name: '', spec: '', hsCode: '', qty: '', unit: '', rate: '' };

/**
 * The specification line, built from the PRODUCT'S OWN specs (owner,
 * 2026-09-25: "product specifications take from the product details itself").
 *
 * 🔴 Both sources, and the LABEL with each value. This used to take the first
 * three `attributes` and print their values alone — "120 · Cotton · White" says
 * nothing on a quotation, and it ignored `customSpecs` entirely, which is where
 * a seller writes the specs that are not in the category's fixed fields.
 *
 * The seller's own words come first, then the category attributes. Trimmed to
 * the 400 characters the quotation schema accepts, on a separator so the cut
 * never lands mid-pair.
 */
const SPEC_MAX = 400;

function specFromProduct(p) {
  const pairs = [
    ...(p.customSpecs ?? []).map((c) => [c?.label, c?.value]),
    ...(p.attributes ?? []).map((a) => [a?.key, a?.value]),
  ]
    .filter(([label, value]) => label && value != null && value !== '')
    // `attributes.key` is stored lowercase, so it needs a capital to read as a
    // label next to the seller's own sentence-case ones.
    .map(([label, value]) => `${String(label).charAt(0).toUpperCase()}${String(label).slice(1)}: ${value}`);

  const out = [];
  let length = 0;
  for (const pair of pairs) {
    const next = length ? length + 3 + pair.length : pair.length;
    if (next > SPEC_MAX) break;
    out.push(pair);
    length = next;
  }
  return out.join(' · ');
}

/** A listing → a quotation line. Price may be absent ("on request") — then the
 *  rate is left empty for the exporter to fill, never guessed as zero. */
function lineFromProduct(p) {
  return {
    name: p.name ?? '',
    spec: specFromProduct(p),
    hsCode: p.hsCode ?? '',
    qty: p.moq ?? '',
    unit: p.unit ?? '',
    rate: p.price?.min != null ? minorToInput(Math.round(p.price.min * 100)) : '',
  };
}

export function ItemPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('');

  const list = useQuery({
    // Only ACTIVE listings: a draft or archived product is not something the
    // exporter can sell today, and offering it invites quoting the unavailable.
    // `pageSize`, NOT `limit` — that is the parameter `listMine` validates, and
    // 100 is its maximum. `limit` was silently ignored and this loaded 20.
    queryKey: productKeys.minePage({ status: 'active', pageSize: 100 }),
    queryFn: () => productsApi.mine({ status: 'active', pageSize: 100 }),
    enabled: open,
  });

  const rows = useMemo(() => {
    const all = list.data?.products ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((p) => p.name?.toLowerCase().includes(term));
  }, [list.data, q]);

  const take = (line) => {
    onPick(line);
    setQ('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an item"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {/* Always available, and never behind a search that found nothing —
              a custom line is a first-class option, not a fallback. */}
          <Button onClick={() => take({ ...BLANK })}>Add a custom line</Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Pick one of your listings to pre-fill the line, or add a custom one for
        anything you do not list — finishing, samples, tooling.
      </p>

      <Input
        className="mt-3"
        label="Search your listings"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Product name"
      />

      <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
        {list.isPending && <Skeleton className="h-16 w-full rounded-xl" />}

        {list.isError && (
          <p className="text-sm text-muted">
            Could not load your listings. You can still add a custom line.
          </p>
        )}

        {list.isSuccess && (list.data?.total ?? 0) > (list.data?.products?.length ?? 0) && (
          <p className="rounded-lg bg-surface-subtle px-3 py-2 text-[12px] text-muted">
            Showing your {list.data.products.length} most recent active listings of{' '}
            {list.data.total}. Search looks through these — add anything else as a custom line.
          </p>
        )}

        {list.isSuccess && rows.length === 0 && (
          <p className="text-sm text-muted">
            {q.trim() ? `Nothing matches “${q.trim()}”.` : 'You have no active listings yet.'}
          </p>
        )}

        {rows.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => take(lineFromProduct(p))}
            className="flex w-full items-center gap-3 rounded-xl border border-surface-border bg-white p-2.5 text-left transition-colors hover:border-primary-600"
          >
            {p.images?.[0] ? (
              <img
                src={typeof p.images[0] === 'string' ? p.images[0] : p.images[0].url}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <NoImagePanel ratio="h-11 w-11" className="shrink-0 rounded-lg" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-900">{p.name}</span>
              <span className="block truncate text-[12px] text-muted">
                {p.moq != null ? `MOQ ${p.moq}${p.unit ? ` ${p.unit}` : ''}` : 'No MOQ set'}
                {p.price?.min != null ? ` · from ${p.price.currency} ${p.price.min}` : ' · price on request'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
