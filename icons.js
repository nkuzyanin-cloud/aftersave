const accentPaths = {
  calendar: '<rect x="3.7" y="5.5" width="16.6" height="14.5" rx="2.5"/><path d="M3.7 10h16.6m-12.35-7v4.3m8.1-4.3v4.3"/>' +
    '<path d="M8.3 14h.01m3.69 0h.01m3.69 0h.01M8.3 17h.01m3.69 0h.01" stroke="#a7d7e9" stroke-width="2"/>',
  game: '<path d="M7.5 7h9a4 4 0 0 1 3.9 3.15l1.07 4.78a2.43 2.43 0 0 1-4.06 2.29L15 15H9l-2.41 2.22a2.43 2.43 0 0 1-4.06-2.29l1.07-4.78A4 4 0 0 1 7.5 7Z"/>' +
    '<g stroke="#a7d7e9"><path d="M7.8 9.65v4.1m-2.05-2.05h4.1M16 12.45h.01m2.2-2.05h.01"/></g>',
  clock: '<circle cx="12" cy="13.5" r="7.3"/><path d="M9.8 3h4.4M12 3v3.2m5.2 1.9 1.25-1.25"/>' +
    '<g stroke="#a7d7e9"><path d="M12 10v3.7l2.4 1.4"/></g>',
  flame: '<path d="M12 22c-4.2 0-7-2.7-7-6.5 0-2.6 1.4-4.7 3.7-6.5-.2 1.8.5 3 1.5 3.5C12.5 9.2 13 6 12 2c4.3 2.9 7 7.8 7 13.1 0 4.1-2.8 6.9-7 6.9Z"/><path d="M12 22c-1.6 0-2.8-1.2-2.8-2.8 0-1.5 1.1-2.7 2.8-4.1 1.7 1.4 2.8 2.6 2.8 4.1 0 1.6-1.2 2.8-2.8 2.8Z"/>',
  trophy: '<path d="M7.4 4.4h9.2v5.1a4.6 4.6 0 0 1-9.2 0V4.4ZM7.4 6.4H4v1.5a3.7 3.7 0 0 0 3.8 3.7m8.4 0A3.7 3.7 0 0 0 20 7.9V6.4h-3.4M12 14.1v5.3m-3.5.15h7"/>' +
    '<g stroke="#a7d7e9"><path d="M10.1 7.25v1.9"/></g>',
  perfect: '<path d="M3.55 9.3c-.48 4.32 1.78 7.97 5.05 9.5m11.85-9.5c.48 4.32-1.78 7.97-5.05 9.5M3.65 13.2l2.0 1.0m-1.1 2 2.3.2m13.5-3.2-2 1m1.1 2-2.3.2"/>' +
    '<g stroke="#f2f6fb" color="#f2f6fb"><path d="M12 3.25 13.72 7l4.09.48-3.05 2.75.82 4.05L12 12.24l-3.58 2.04.82-4.05-3.05-2.75L10.28 7 12 3.25Z"/><circle cx="12" cy="20.45" r=".78" fill="currentColor" stroke="none"/></g>',
  layers: '<path d="M10.7 4.2h5.5a2 2 0 0 1 1.97 1.64l2.06 11.34a2 2 0 0 1-1.96 2.36h-4.9"/><rect x="3.8" y="4.1" width="10.7" height="16" rx="2.45"/>' +
    '<g stroke="#a7d7e9"><path d="M6.8 8.15h4.7m-4.7 3h2.65m-2.65 5.2h4.7"/></g>',
  heart: '<path d="M20.2 6.1a4.55 4.55 0 0 0-6.44 0L12 7.86l-1.76-1.76A4.55 4.55 0 1 0 3.8 12.54L12 20l8.2-7.46a4.55 4.55 0 0 0 0-6.44Z"/>',
  chart: '<path d="M4.1 4.9v12.8a2 2 0 0 0 2 2h13.8"/>' +
    '<g stroke="#a7d7e9"><path d="M8.2 15.85V12.5m4.6 3.35V9.5m4.6 6.35V6.2"/></g>',
  news: '<rect x="3.9" y="5" width="16.2" height="14" rx="2.7"/>' +
    '<g stroke="#a7d7e9"><path d="M7.3 8.6h4v3.1h-4zm7.1.15h2.35m-2.35 2.75h2.35M7.3 15.35h9.45"/></g>',
  pie: '<path d="M10.7 4A8.2 8.2 0 1 0 20 13.3h-9.3V4Z"/>' +
    '<g stroke="#a7d7e9"><path d="M14 3.7V10h6.3A7.35 7.35 0 0 0 14 3.7Z"/></g>',
};

const paths = {
  ribbon: '<path d="M5 2.5h14a2 2 0 0 1 2 2v16a1 1 0 0 1-1.54.84L12 16.5l-7.46 4.84A1 1 0 0 1 3 20.5v-16a2 2 0 0 1 2-2Z" fill="currentColor" stroke="none"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M10 3h4l.6 2.2 1.4.8 2.2-.6 2 3.5-1.6 1.6v1.7l1.6 1.6-2 3.5-2.2-.6-1.4.8-.6 2.5h-4l-.6-2.5-1.4-.8-2.2.6-2-3.5 1.6-1.6v-1.7L3.8 9l2-3.5 2.2.6 1.4-.8z" transform="translate(0 1)"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  steam: '<circle cx="12" cy="12" r="10.5" fill="currentColor" stroke="none"/><path d="m3.2 14.9 5.7 2.4 5.5-6.7" stroke="var(--steam-icon-cutout,#192430)" stroke-width="2.4"/><circle cx="8.9" cy="17.1" r="2.3" fill="currentColor" stroke="var(--steam-icon-cutout,#192430)" stroke-width="1.3"/><circle cx="15.8" cy="8.8" r="3.4" fill="currentColor" stroke="var(--steam-icon-cutout,#192430)" stroke-width="1.5"/>',
  cloudDownload: '<path d="M7 17H6a4 4 0 0 1-.6-8 6.2 6.2 0 0 1 11.7-1.3 4.7 4.7 0 0 1 .8 9.3H17M12 12v9m-3-3 3 3 3-3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="m3 3 18 18M9.5 6.3A10 10 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3.2 3.6M6.4 7.6A15 15 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.7"/>',
  library: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5m-5 5a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>',
  trend: '<path d="M3 19h18M4 14l5-5 4 4 7-8m-5 0h5v5"/>',
  gem: '<path d="M7 4h10l4 5-9 11L3 9l4-5ZM3 9h18M9 9l3 11 3-11M9 9l3-5 3 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><path stroke-width="4" d="M8 5v2m8 4v2m-6 4v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  upRight: '<path d="M6 18 18 6M7 6h11v11"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  checklist: '<path d="m3 5 2 2 3-3m-5 8 2 2 3-3m-5 8 2 2 3-3M12 6h9m-9 7h9m-9 7h9"/>',
  pin: '<path d="M20 10c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
  moon: '<path d="M20.7 15.2A9 9 0 0 1 9 3.3 9 9 0 1 0 20.7 15.2Z"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="m13.5 6.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  shield: '<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  filter: '<path d="M3.5 5h17l-6.7 7.6v5.8l-3.6 1.5v-7.3Z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-5 5 6"/>'
};

export function icon(name, size = 20) {
  const accent = accentPaths[name];
  const plain = paths[name];
  const stroke = name === 'perfect' ? '#e7edf4' : plain ? 'currentColor' : '#8ebbd5';
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${accent || plain || accentPaths.game}</svg>`;
}
