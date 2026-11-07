const paths = {
  brand: '<path d="M5 4h14l3 4v8l-3 4H5l-3-4V8z"/><path d="m7 16 3.5-8h3L17 16m-8.5-3h7"/>',
  library: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5"/>',
  bookmark: '<path d="M6 4h12a1 1 0 0 1 1 1v16l-7-5-7 5V5a1 1 0 0 1 1-1Z"/>',
  chart: '<path d="M4 3v17h17M9 15v-4m5 4V7m5 8V4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><path stroke-width="4" d="M8 5v2m8 4v2m-6 4v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  upRight: '<path d="M6 18 18 6M7 6h11v11"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  game: '<path d="M6.2 6h11.6c2 0 3.4 1.5 3.8 3.3l1.1 5.1c.5 2.5-2.2 4.2-4.1 2.5L15.4 14H8.6l-3.2 2.9c-1.9 1.7-4.6 0-4.1-2.5l1.1-5.1C2.8 7.5 4.2 6 6.2 6Z"/><path d="M7 8.5v5m-2.5-2.5h5m6.5 0h.01m3 1h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v7a5 5 0 0 1-10 0V4Zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4"/>',
  pulse: '<path d="M2 12h5l3-6 4 12 3-6h5"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  star: '<path d="m12 3 2.8 5.8 6.4 1-4.6 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.8l6.4-1L12 3Z"/>',
  sort: '<path d="M9 6h12m-12 6h8m-8 6h4M5 19V5M2 8l3-3 3 3"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="m13.5 6.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  shield: '<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  sparkle: '<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  filter: '<path d="M3 6h18M6 12h12m-9 6h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-5 5 6"/>'
};

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.game}</svg>`;
}
