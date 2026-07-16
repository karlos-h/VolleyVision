// Line-art icon set for the app shell (docs/design/player-dashboard-light.html).
// Stroked, 24×24 viewBox, currentColor — size and colour come from the caller.

type IconProps = { className?: string };

function base(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function TeamIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c0-3.2 2.5-5 5.5-5s5.5 1.8 5.5 5" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M16 13.6c2.6-.2 5 1.2 5 4.4" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3.5l7 2.6v5.2c0 4.2-2.9 7.5-7 9.2-4.1-1.7-7-5-7-9.2V6.1l7-2.6Z" />
    </svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13 3 L6.5 13 H11 L10 21 L17.5 10.5 H12.5 Z" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path d="M4 7.5l8 5.2 8-5.2" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" />
    </svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 8h8M17 8h3M4 16h3M12 16h8" />
      <circle cx="14" cy="8" r="2.1" />
      <circle cx="9" cy="16" r="2.1" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.8 5.8 1.8 5.8H4.2S6 13.5 6 9Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
      <path d="M13.5 7 17 10.5" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M15 17v1.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2V7" />
      <path d="M10.5 12h9m0 0-3-3m3 3-3 3" />
    </svg>
  );
}
