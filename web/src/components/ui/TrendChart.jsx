import { useId, useRef, useState } from 'react';

/**
 * A dependency-free interactive GROWTH chart (the section's settled form,
 * owner-directed through five treatments on 2026-08-18).
 *
 * Why CUMULATIVE: the underlying series are sparse daily counts (0,0,4,0,2…),
 * and any per-day line of that shape draws circus-tent humps that touch zero
 * between spikes — the thing the owner kept rejecting. The running total is
 * monotone up-and-right, which is both the classic dashboard growth curve AND
 * an honest reading: "how much has accumulated this fortnight". The daily
 * figure is not lost — the tooltip shows the day's own +N beside the total.
 *
 * The legend IS the summary: one button per series carrying its dot, its name
 * and its fortnight TOTAL. Click toggles the series (`aria-pressed`).
 *
 * Interactivity: pointer nearest-day snapping with a guide and ringed marker;
 * keyboard ←/→/Home/End/Esc on the focusable svg; an sr-only live region reads
 * the active day. All motion dies under prefers-reduced-motion. Colour never
 * carries meaning alone — dot + name in legend and tooltip.
 */
const VB_W = 560;
const VB_H = 200;
const PAD_L = 30;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

function dayLabel(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function runningTotals(values) {
  let acc = 0;
  return values.map((v) => {
    acc += v;
    return acc;
  });
}

export function TrendChart({ days, series, onDark = false }) {
  const uid = useId();
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());

  const enriched = series.map((s) => ({ ...s, totals: runningTotals(s.values) }));
  const shown = enriched.filter((s) => !hidden.has(s.key));
  const max = Math.max(1, ...shown.map((s) => s.totals[s.totals.length - 1] ?? 0));
  const innerW = VB_W - PAD_L - PAD_R;
  const innerH = VB_H - PAD_T - PAD_B;
  const x = (i) => PAD_L + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v) => PAD_T + innerH - (v / max) * innerH;

  const line = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = (vals) =>
    `${line(vals)} L${x(vals.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(
      PAD_T + innerH
    ).toFixed(1)} Z`;

  const clampIdx = (i) => Math.max(0, Math.min(days.length - 1, i));
  const idxFromClientX = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const vx = ((clientX - rect.left) / rect.width) * VB_W;
    return clampIdx(Math.round(((vx - PAD_L) / innerW) * (days.length - 1)));
  };

  const onKeyDown = (e) => {
    const moves = {
      ArrowLeft: () => clampIdx((active ?? days.length - 1) - 1),
      ArrowRight: () => clampIdx((active ?? -1) + 1),
      Home: () => 0,
      End: () => days.length - 1,
      Escape: () => null,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]());
    }
  };

  const quiet = shown.length > 0 && shown.every((s) => (s.totals[s.totals.length - 1] ?? 0) === 0);

  const chrome = onDark
    ? {
        plotWrap: 'rounded-xl bg-white/5 p-3 ring-1 ring-inset ring-white/10',
        legendOn: 'text-white',
        legendOff: 'text-white/35',
        legendRing: 'focus-visible:ring-white/70',
        legendTotal: 'text-white',
        dotOff: 'bg-white/30',
        axisText: 'fill-white/50',
        gridLine: 'text-white/40',
        guide: 'text-white/50',
        focusRing: 'focus-visible:ring-white/70',
        note: 'fill-white/60',
        tooltip: 'bg-primary-900/95 text-white ring-1 ring-white/10',
        tooltipLabel: 'text-white/60',
        tooltipMeta: 'text-white/75',
        pointRing: 'rgba(19,31,102,0.9)',
      }
    : {
        // The plot sits on its own softly-tinted panel instead of raw card
        // white, and every line of chrome is a SOLID hairline — dashes read
        // as a draft.
        plotWrap: 'rounded-xl bg-gradient-to-b from-primary-50/60 via-white to-white p-3 ring-1 ring-inset ring-primary-100/70',
        legendOn: 'text-ink-700',
        legendOff: 'text-ink-300',
        legendRing: 'focus-visible:ring-primary-300',
        legendTotal: 'text-ink-900',
        dotOff: 'bg-ink-300',
        axisText: 'fill-ink-400',
        gridLine: 'text-ink-300',
        guide: 'text-primary-300',
        focusRing: 'focus-visible:ring-primary-300',
        note: 'fill-ink-400',
        tooltip: 'bg-white text-ink-900 ring-1 ring-surface-border shadow-lift',
        tooltipLabel: 'text-ink-500',
        tooltipMeta: 'text-ink-600',
        pointRing: 'white',
      };

  return (
    <div className="min-w-0">
      {/* The legend IS the summary — dot, name, fortnight total, toggle. */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {enriched.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.key)) next.delete(s.key);
                  else next.add(s.key);
                  return next;
                })
              }
              className={`inline-flex items-center gap-2 rounded-md px-1 py-0.5 transition-opacity hover:opacity-75 focus:outline-none focus-visible:ring-2 ${chrome.legendRing} ${
                off ? chrome.legendOff : chrome.legendOn
              }`}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${off ? chrome.dotOff : s.dotClass}`} />
              <span className={`text-[12px] font-medium ${off ? 'line-through' : ''}`}>{s.label}</span>
              <span className={`text-[15px] font-bold tabular-nums ${off ? '' : chrome.legendTotal}`}>
                {s.totals[s.totals.length - 1] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`mt-3 ${chrome.plotWrap}`}>
        <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={`block w-full rounded-lg focus:outline-none focus-visible:ring-2 ${chrome.focusRing}`}
          role="img"
          aria-label={`Cumulative activity across the last ${days.length} days. Use the arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={(e) => setActive(idxFromClientX(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          <defs>
            {/* Colour class ON the def element — currentColor in a gradient
                resolves from the gradient's own context, not the referencing
                path; bare defs inherit the page ink and render grey. */}
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1" className={s.colorClass}>
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>

          {/* Chrome kept minimal: baseline, one mid gridline, max label. */}
          <line
            x1={PAD_L}
            x2={VB_W - PAD_R}
            y1={PAD_T + innerH}
            y2={PAD_T + innerH}
            stroke="currentColor"
            strokeOpacity="0.55"
            className={chrome.gridLine}
          />
          <line
            x1={PAD_L}
            x2={VB_W - PAD_R}
            y1={y(max / 2)}
            y2={y(max / 2)}
            stroke="currentColor"
            strokeOpacity="0.18"
            className={chrome.gridLine}
          />
          <text x={PAD_L - 6} y={y(max) + 3} textAnchor="end" fontSize="9" className={`tabular-nums ${chrome.axisText}`}>
            {max}
          </text>
          <text x={PAD_L - 6} y={PAD_T + innerH + 3} textAnchor="end" fontSize="9" className={`tabular-nums ${chrome.axisText}`}>
            0
          </text>

          {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={VB_H - 6}
              textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
              fontSize="9"
              className={chrome.axisText}
            >
              {dayLabel(days[i])}
            </text>
          ))}

          {active != null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="currentColor"
              className={chrome.guide}
            />
          )}

          {shown.map((s) => (
            <g key={s.key} className={s.colorClass}>
              <path d={area(s.totals)} fill={`url(#${uid}-${s.key})`} className="chart-fade" />
              <path
                d={line(s.totals)}
                pathLength="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="chart-draw"
              />
              {active != null && (
                <circle
                  cx={x(active)}
                  cy={y(s.totals[active])}
                  r="4"
                  fill="currentColor"
                  stroke={chrome.pointRing}
                  strokeWidth="1.5"
                />
              )}
            </g>
          ))}

          {quiet && (
            <text x={VB_W / 2} y={PAD_T + innerH / 2} textAnchor="middle" fontSize="11" className={chrome.note}>
              No activity in this window yet
            </text>
          )}
          {shown.length === 0 && (
            <text x={VB_W / 2} y={PAD_T + innerH / 2} textAnchor="middle" fontSize="11" className={chrome.note}>
              All series hidden — tap a legend chip to bring one back
            </text>
          )}
        </svg>

        {active != null && shown.length > 0 && (
          /* 🔴 Edge-aware anchoring: a centred box runs off the card on the
              first and last days and cut the "+N that day" clean off. Near the
              left edge it opens rightward from the guide; near the right edge
              it opens leftward; centred otherwise. */
          <div
            className={`pointer-events-none absolute top-0 z-10 rounded-lg px-3 py-2 shadow-lift ${chrome.tooltip} ${
              x(active) / VB_W < 0.18
                ? 'ml-2'
                : x(active) / VB_W > 0.82
                  ? '-ml-2 -translate-x-full'
                  : '-translate-x-1/2'
            }`}
            style={{ left: `${(x(active) / VB_W) * 100}%` }}
          >
            <p className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider ${chrome.tooltipLabel}`}>
              {dayLabel(days[active])}
            </p>
            {shown.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[12px]">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dotClass}`} />
                <span className={chrome.tooltipMeta}>{s.label}</span>
                <span className="font-bold tabular-nums">{s.totals[active]}</span>
                {s.values[active] > 0 && (
                  <span className={`text-[11px] ${chrome.tooltipMeta}`}>+{s.values[active]} that day</span>
                )}
              </p>
            ))}
          </div>
        )}

        <span aria-live="polite" className="sr-only">
          {active != null &&
            `${dayLabel(days[active])}: ${shown
              .map((s) => `${s.label} ${s.totals[active]} total, ${s.values[active]} that day`)
              .join(', ')}`}
        </span>
        </div>
      </div>
    </div>
  );
}
