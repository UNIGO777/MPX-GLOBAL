import { Calendar, CreditCard, Expand, KeyRound, Mail, MapPin, Shield, SlidersHorizontal } from 'lucide-react';

/**
 * Minimal inline SVG icon set (1.8 stroke, currentColor) — no icon-font network
 * dependency. Add here rather than importing an icon library, so every glyph in
 * the app comes from one place and carries one stroke weight.
 *
 * `lucide-react` is allowed for individual glyphs (owner, 2026-08-02) — import
 * the ONE icon needed and wrap it below to match this set's API and weight.
 * Never `import * as icons`: that defeats tree-shaking and ships the pack.
 */
function Svg({ children, className = 'h-5 w-5', ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p) => <Svg {...p}><path d="M5 13l4 4L19 7" /></Svg>;
export const CheckCircleIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Svg>
);
export const XIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const MenuIcon = (p) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const AlertIcon = (p) => (
  <Svg {...p}><path d="M12 9v4m0 4h.01M10.3 3.9L2.5 17.3a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></Svg>
);
export const InfoIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M12 11v5" /></Svg>
);
export const EyeIcon = (p) => (
  <Svg {...p}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></Svg>
);
export const EyeOffIcon = (p) => (
  <Svg {...p}><path d="M3 3l18 18M10.7 5.1A10 10 0 0122 12a16 16 0 01-3.2 3.9M6.6 6.6A16 16 0 002 12s3.5 6.5 10 6.5c1.5 0 2.9-.3 4.1-.8" /><path d="M9.9 9.9a2.8 2.8 0 004 4" /></Svg>
);
export const ChevronDownIcon = (p) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const ChevronLeftIcon = (p) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
export const ChevronRightIcon = (p) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const SearchIcon = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></Svg>
);
export const UploadIcon = (p) => (
  <Svg {...p}><path d="M12 16V4m0 0L7 9m5-5l5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></Svg>
);
export const FileIcon = (p) => (
  <Svg {...p}><path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8z" /><path d="M14 3v5h5" /></Svg>
);
export const TrashIcon = (p) => (
  <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13h8l1-13" /><path d="M10 11v6m4-6v6" /></Svg>
);
export const UserIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></Svg>
);
export const UsersIcon = (p) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.7c2.4.6 4 2.4 4 5.3" /></Svg>
);
// Lucide's shield, wrapped so it keeps this set's API and 1.8 stroke — swapping
// the glyph without the wrapper would render it heavier than every icon beside
// it (owner asked for lucide here, 2026-08-02). Only per-icon imports: the whole
// pack must never be pulled in.
export const ShieldIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <Shield aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);
export const DocIcon = (p) => (
  <Svg {...p}><path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Svg>
);
export const HomeIcon = (p) => (
  <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>
);
export const SettingsIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h.1a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></Svg>
);
export const LogOutIcon = (p) => (
  <Svg {...p}><path d="M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Svg>
);
export const CopyIcon = (p) => (
  <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" /></Svg>
);
export const RefreshIcon = (p) => (
  <Svg {...p}><path d="M20 11a8 8 0 10.5 4" /><path d="M20 4v7h-7" /></Svg>
);
export const ClockIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></Svg>
);
export const BuildingIcon = (p) => (
  <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 21v-4h6v4M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2" /></Svg>
);
export const GlobeIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z" /></Svg>
);
export const ExternalIcon = (p) => (
  <Svg {...p}><path d="M14 5h5v5M19 5l-8 8" /><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" /></Svg>
);
export const ChatIcon = (p) => (
  <Svg {...p}><path d="M21 12a8 8 0 01-8 8H4l2.3-2.7A8 8 0 1121 12z" /></Svg>
);
export const BoxIcon = (p) => (
  <Svg {...p}><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></Svg>
);
export const ListIcon = (p) => (
  <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></Svg>
);
/** Empty-search state (design: "No accounts match those filters"). */
export const SearchOffIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.2 16.2L21 21" />
    {/* Struck top-right to bottom-left, so the strike can't sit collinear with
        the handle — the old glyph's stray stub read as a rendering fault. */}
    <path d="M17.5 4.5L4.5 17.5" />
  </Svg>
);
/** Load-failure state (design: "We couldn't load the directory"). */
export const CloudOffIcon = (p) => (
  <Svg {...p}>
    <path d="M17 18H7a4 4 0 0 1-.7-7.94A6 6 0 0 1 16.5 8.5" />
    <path d="M3 3l18 18" />
  </Svg>
);
/** Row actions (⋮) — opens the per-row menu. */
export const MoreVerticalIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </Svg>
);
/** Deactivate — a struck-through person. */
export const SlashIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Svg>
);
/** Verification review — a badge with a tick (the row menu's decision entry). */
export const BadgeCheckIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.6-1.3 1.7-2 3-2s2.4.7 3 2M15 10h4M15 13.5h3" />
  </Svg>
);

export const TagIcon = (props) => (
  <Svg {...props}>
    <path d="M20.59 13.41 12 22l-8.59-8.59A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.41.59L22 12a2 2 0 0 1-1.41 1.41Z" />
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const KeyIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <KeyRound aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

/** Trade-facts rows: payment terms / pricing model (`ProductDetail.jsx`). */
export const CreditCardIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <CreditCard aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

/** The disabled "Send Enquiry" placeholder (`ProductDetail.jsx` — Module 4,
 *  not built; see the button's own comment). */
export const MailIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <Mail aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

/** Seller card's country row (`ProductDetail.jsx`) — a location pin reads
 *  more precisely as "this is a place" than the world/globe glyph. */
export const MapPinIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <MapPin aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

/** Gallery's fullscreen/zoom trigger (`ProductDetail.jsx`). */
export const ExpandIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <Expand aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

/** The mobile "Filters" trigger (`CategoryListing.jsx`). */
export const FilterIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <SlidersHorizontal aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

/** "Est. {year}" fact pill (`SupplierProfile.jsx`). */
export const CalendarIcon = ({ className = 'h-5 w-5', ...rest }) => (
  <Calendar aria-hidden="true" strokeWidth={1.8} className={className} {...rest} />
);

export const ImageIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 15-4.2-4.2a1 1 0 0 0-1.42 0L7 19M14 19l3.4-3.4" />
  </Svg>
);

/** Save/favourite (unfilled — filled-on-select is a future state, not drawn
 *  since nothing here is wired yet; see `ProductListCard.jsx`). */
export const HeartIcon = (p) => (
  <Svg {...p}>
    <path d="M12 20.6 4.3 13a4.9 4.9 0 0 1 0-7 4.7 4.7 0 0 1 6.9 0l.8.8.8-.8a4.7 4.7 0 0 1 6.9 0 4.9 4.9 0 0 1 0 7z" />
  </Svg>
);

/** An unselected filter-pill's leading glyph (`FilterSidebar.jsx`). */
export const PlusIcon = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
