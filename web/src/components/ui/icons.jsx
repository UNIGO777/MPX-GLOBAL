/**
 * Minimal inline SVG icon set (1.5pt stroke, currentColor) — no icon-font
 * network dependency. Add here rather than importing an icon library.
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
export const ShieldIcon = (p) => (
  <Svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /></Svg>
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
