import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supportApi, supportKeys } from '../../api/support.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatListTime } from '../../lib/format.js';
import { TICKET_CATEGORIES, CATEGORY_LABEL } from '../../lib/support.js';
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, chatFileProblem, fileBadge, formatFileSize, isImageFile } from '../../lib/chatFiles.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from '../buyer/buyerNav.js';
import { EXPORTER_NAV } from '../exporter/exporterNav.js';
import { SupportContactCards } from '../../components/public/SupportContact.jsx';
import { StepTitle } from '../../components/support/StepTitle.jsx';
import { TicketStatusChip } from '../../components/support/TicketStatusChip.jsx';
import { TOPIC_META, TopicIcon } from '../../components/support/TopicIcon.jsx';
import { useSupportContact } from '../../hooks/useSupportContact.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer, DrawerActions } from '../../components/ui/Drawer.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { CheckIcon, HelpIcon, InfoIcon, LinkIcon, PaperclipIcon, PlusIcon, XIcon } from '../../components/ui/icons.jsx';

/**
 * `/buyer/support` · `/exporter/support` — Help & support inside the portal
 * (Step 1b). The published contact, this account's own tickets, and "New
 * ticket". Scoped server-side to this company AND this side.
 */
export function MySupport() {
  const { user } = useAuth();
  const side = user?.role === 'exporter' ? 'exporter' : 'buyer';
  const nav = side === 'exporter' ? EXPORTER_NAV : BUYER_NAV;
  const navigate = useNavigate();
  const qc = useQueryClient();
  // `?new=1` (from a closed ticket's "Raise a new ticket") opens the form straight away.
  const [params, setParams] = useSearchParams();
  // `&from=<id>&ref=<T-…>` links the new ticket to the closed one (the server
  // re-checks that it is this account's own ticket).
  const [newOpen, setNewOpen] = useState(() => params.get('new') === '1');
  const [followUp, setFollowUp] = useState(() =>
    params.get('from') ? { id: params.get('from'), ref: params.get('ref') ?? '' } : null,
  );
  useEffect(() => {
    if (params.has('new') || params.has('from')) {
      setParams((p) => { p.delete('new'); p.delete('from'); p.delete('ref'); return p; }, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Help & support — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const list = useQuery({ queryKey: supportKeys.mine({}), queryFn: () => supportApi.myTickets({ pageSize: 50 }) });
  const rows = list.data?.rows ?? [];
  const contact = useSupportContact();

  const create = useMutation({
    mutationFn: supportApi.create,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: supportKeys.mineAll });
      setNewOpen(false);
      navigate(`/${side}/support/${res.ticket.id}`);
    },
  });

  const [filter, setFilter] = useState('all');
  const counts = {
    all: rows.length,
    active: rows.filter((t) => t.status !== 'resolved').length,
    resolved: rows.filter((t) => t.status === 'resolved').length,
  };
  const shown = rows.filter((t) =>
    filter === 'active' ? t.status !== 'resolved' : filter === 'resolved' ? t.status === 'resolved' : true,
  );

  return (
    <PortalLayout nav={nav} wide>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Help &amp; support</h1>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            Raise a ticket and the MPX Global team replies here — you&apos;ll get an email too.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { create.reset(); setFollowUp(null); setNewOpen(true); }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          New ticket
        </button>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3 sm:px-5">
            <h2 className="text-[15px] font-bold text-ink-900">Your tickets</h2>
            {rows.length > 0 && (
              <div role="group" aria-label="Show" className="inline-flex rounded-full border border-ink-200 bg-white p-0.5">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'resolved', label: 'Resolved' },
                ].map((f) => {
                  const on = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFilter(f.key)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
                        on ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      {f.label}
                      <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? 'bg-white/20' : 'bg-ink-100 text-ink-500'}`}>{counts[f.key]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {list.isLoading && <SkeletonRows rows={4} />}
          {list.error && <ErrorState message={apiError(list.error).message} onRetry={list.refetch} />}
          {list.isSuccess && rows.length === 0 && (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <HelpIcon className="h-7 w-7" />
              </span>
              <p className="mt-4 text-base font-bold text-ink-900">No tickets yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Stuck on something? Raise a ticket and our team will get back to you here.
              </p>
              <Button size="sm" className="mt-5" onClick={() => setNewOpen(true)}>Raise a ticket</Button>
            </div>
          )}
          {rows.length > 0 && shown.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted">Nothing here.</p>
          )}
          {shown.length > 0 && (
            <ul className="divide-y divide-surface-border">
              {shown.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/${side}/support/${t.id}`}
                    className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-ink-50 sm:px-5 ${t.unread ? 'bg-primary-50/40' : ''}`}
                  >
                    <TopicIcon category={t.category} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[14.5px] ${t.unread ? 'font-bold' : 'font-semibold'} text-ink-900`}>{t.subject}</span>
                        {t.unread && (
                          <span className="hidden shrink-0 rounded-full bg-primary-600 px-2 py-px text-[10.5px] font-bold text-white sm:inline">Update</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {t.unread && <span className="font-bold text-primary-700 sm:hidden">Update · </span>}
                        <span className="font-mono">{t.ref}</span> · {CATEGORY_LABEL[t.category] ?? t.category}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <TicketStatusChip status={t.status} size="sm" />
                      <span className="text-[11.5px] text-muted">{formatListTime(t.lastMessageAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card">
            <h2 className="text-[15px] font-bold text-ink-900">How support works</h2>
            <ol className="mt-3 space-y-3">
              {[
                ['Raise a ticket', 'Pick a topic and tell us what happened. Add a screenshot if it helps.'],
                ['We reply here', 'Our team answers in the ticket, and we email you when we do.'],
                ['Resolved means closed', 'Still need help after that? Raise a new ticket and mention the old reference.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[12px] font-bold text-primary-700">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink-900">{title}</span>
                    <span className="block text-[12.5px] leading-snug text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {contact.hasAny && (
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-ink-600">Prefer email or phone?</h2>
              <SupportContactCards stacked />
            </section>
          )}
        </aside>
      </div>

      <NewTicketDrawer
        open={newOpen}
        onClose={() => { setNewOpen(false); setFollowUp(null); }}
        followUp={followUp}
        saving={create.isPending}
        error={create.error ? apiError(create.error).message : null}
        onSubmit={(v) => create.mutate({ ...v, ...(followUp ? { followUpOf: followUp.id } : {}) })}
      />
    </PortalLayout>
  );
}

/** What to include, per topic — shown once a topic is picked. */
const TOPIC_TIP = {
  account: 'Say which email or mobile you sign in with, and the exact message you see.',
  verification: 'Name the document and what happens when you upload it.',
  products: 'Include the product name, and what you expected to see.',
  enquiries: 'Name the company you were talking to, and roughly when.',
  technical: 'What you clicked, what happened, and what you expected. A screenshot helps most.',
  other: 'Give us as much detail as you can.',
};

function NewTicketDrawer({ open, onClose, followUp, saving, error, onSubmit }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [problem, setProblem] = useState(null);
  const inputRef = useRef(null);

  const reset = () => { setSubject(''); setCategory(''); setBody(''); setFile(null); setProblem(null); };
  const close = () => { if (!saving) { reset(); onClose(); } };
  const missing = !category
    ? 'Pick a topic'
    : subject.trim().length < 3
      ? 'Add a subject'
      : !body.trim() && !file
        ? 'Write a message'
        : null;

  return (
    <Drawer
      open={open}
      onClose={close}
      icon={HelpIcon}
      title="New support ticket"
      subtitle="A person on our team reads it. We reply here and email you."
      footer={
        <DrawerActions hint={missing ? `${missing} to send` : 'Ready to send'}>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
          <Button loading={saving} disabled={Boolean(missing)} onClick={() => onSubmit({ subject: subject.trim(), category, body: body.trim(), file })}>
            Send ticket
          </Button>
        </DrawerActions>
      }
    >
      <div className="space-y-7">
        {error && <Alert tone="danger">{error}</Alert>}
        {followUp && (
          <p className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2.5 text-[13px] text-ink-800">
            <LinkIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <span>
              Follow-up to <span className="font-mono font-semibold">{followUp.ref}</span> — our team will see the earlier ticket.
            </span>
          </p>
        )}

        {/* Topic as picture cards — a dropdown hid the choices. */}
        <fieldset>
          <StepTitle n={1} done={Boolean(category)} as="legend">What is it about?</StepTitle>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Topic">
            {TICKET_CATEGORIES.map((c) => {
              const on = category === c.value;
              const meta = TOPIC_META[c.value] ?? TOPIC_META.other;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategory(c.value)}
                  className={`relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                    on
                      ? 'border-primary-600 bg-primary-50/60 shadow-sm ring-1 ring-primary-600'
                      : 'border-surface-border bg-white hover:-translate-y-px hover:border-primary-300 hover:shadow-sm motion-reduce:transform-none'
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.tint}`} aria-hidden="true">
                    <meta.Icon className="h-[18px] w-[18px]" />
                  </span>
                  {on && (
                    <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white" aria-hidden="true">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className={`block text-[13.5px] font-semibold leading-tight ${on ? 'text-primary-800' : 'text-ink-900'}`}>{c.label}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{meta.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <section aria-label="Describe the problem">
          <StepTitle n={2} done={subject.trim().length >= 3 && Boolean(body.trim() || file)}>
            Describe it
          </StepTitle>
          {category && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-surface-subtle px-3 py-2.5 text-[12.5px] leading-snug text-ink-700">
              <InfoIcon className="mt-px h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              {TOPIC_TIP[category]}
            </p>
          )}
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="new-ticket-subject" className="text-sm font-semibold text-ink-900">Subject</label>
                <span className="text-xs tabular-nums text-muted">{subject.length}/120</span>
              </div>
              <input
                id="new-ticket-subject"
                className={inputClasses(false)}
                maxLength={120}
                placeholder="e.g. My GST certificate won't upload"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="new-ticket-body" className="text-sm font-semibold text-ink-900">Message</label>
                <span className="text-xs tabular-nums text-muted">{body.length}/2000</span>
              </div>
              <textarea
                id="new-ticket-body"
                rows={6}
                maxLength={2000}
                className={inputClasses(false, 'h-auto py-3')}
                placeholder="What happened, and what did you expect?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section aria-label="Attachment">
          <StepTitle n={3} done={Boolean(file)} optional>Add a file</StepTitle>
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-white p-2.5 shadow-sm">
              {isImageFile(file) ? (
                <ImagePreview file={file} />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-[11px] font-bold text-primary-700">
                  {fileBadge(file.name)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{file.name}</span>
                <span className="block text-xs text-muted">{formatFileSize(file.size)}</span>
              </span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-ink-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                <PaperclipIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink-800">Add a screenshot or document</span>
                <span className="block text-[11.5px] text-muted">One image, PDF, Word or Excel file · up to 8 MB</span>
              </span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={`${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}`}
            className="sr-only"
            aria-label="Attach a file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const p = chatFileProblem(f, isImageFile(f) ? 'image' : 'document');
              setProblem(p);
              setFile(p ? null : f);
            }}
          />
          {problem && <p className="mt-1.5 text-xs font-medium text-danger-700">{problem}</p>}
        </section>
      </div>
    </Drawer>
  );
}

/**
 * A local preview of the picked image. The object URL is released once the
 * image has decoded — an effect cleanup would also run on StrictMode's
 * simulated unmount and revoke it before the <img> ever loaded.
 */
function ImagePreview({ file }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <img
      src={url}
      alt=""
      onLoad={() => URL.revokeObjectURL(url)}
      className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-surface-border"
    />
  );
}
