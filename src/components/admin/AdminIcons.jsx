// Ícones lineares locais (24x24, traço 1.75), herdam a cor do texto via currentColor.
function Icon({ children, size = 20 }) {
  return (
    <svg
      className="adm-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const icons = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  ),
  site: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 14h8M8 17h5" />
    </Icon>
  ),
  products: (
    <Icon>
      <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </Icon>
  ),
  content: (
    <Icon>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
      <path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2h-1" />
      <path d="M9 8h5M9 12h5M9 16h3" />
    </Icon>
  ),
  faq: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  feedbacks: (
    <Icon>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" />
      <path d="M8 10h8M8 13h5" />
    </Icon>
  ),
  lessons: (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10.5 9.5 4 2.5-4 2.5v-5Z" />
    </Icon>
  ),
  access: (
    <Icon>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8M16 7l2.5 2.5M14 9l1.5 1.5" />
    </Icon>
  ),
  users: (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.6 3.2 2.2 3.5 5.2" />
    </Icon>
  ),
  forms: (
    <Icon>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11l1.8 1.8L15 9M9 17h6" />
    </Icon>
  ),
  events: (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M8 15h2" />
    </Icon>
  ),
  preview: (
    <Icon>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  comments: (
    <Icon>
      <path d="M3 6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5V14H5a2 2 0 0 1-2-2V6Z" />
      <path d="M19 9h0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2v2.5L15.5 19H12a2 2 0 0 1-1.5-.7" />
    </Icon>
  ),
  audit: (
    <Icon>
      <path d="M12 3 4.5 6v5.5c0 4.4 3 7.6 7.5 9.5 4.5-1.9 7.5-5.1 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Icon>
  ),
  external: (
    <Icon>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </Icon>
  ),
  menu: (
    <Icon size={22}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  ),
  close: (
    <Icon size={22}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  ),
};
