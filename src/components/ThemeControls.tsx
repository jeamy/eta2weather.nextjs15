'use client';

import { useEffect, useState } from 'react';
import { applyTheme, DEFAULT_PALETTE_ID, THEME_MODE_KEY, THEME_PALETTE_KEY, THEME_PALETTES, ThemeMode } from '@/lib/themePalettes';

export default function ThemeControls() {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [palette, setPalette] = useState(DEFAULT_PALETTE_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(THEME_MODE_KEY);
    const storedPalette = window.localStorage.getItem(THEME_PALETTE_KEY);
    const initialMode: ThemeMode = storedMode === 'dark' || storedMode === 'light'
      ? storedMode
      : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const initialPalette = THEME_PALETTES.some(item => item.id === storedPalette)
      ? storedPalette!
      : DEFAULT_PALETTE_ID;
    setMode(initialMode);
    setPalette(initialPalette);
    applyTheme(initialMode, initialPalette);
    setReady(true);
  }, []);

  const changeMode = (next: ThemeMode) => {
    setMode(next);
    applyTheme(next, palette);
    window.localStorage.setItem(THEME_MODE_KEY, next);
  };

  const changePalette = (next: string) => {
    setPalette(next);
    applyTheme(mode, next);
    window.localStorage.setItem(THEME_PALETTE_KEY, next);
  };

  return (
    <div className="theme-controls" aria-label="Darstellung" data-ready={ready}>
      <div className="mode-switch" role="group" aria-label="Farbmodus">
        <button type="button" className={mode === 'dark' ? 'is-active' : ''} onClick={() => changeMode('dark')} title="Dark Mode" aria-label="Dark Mode">☾</button>
        <button type="button" className={mode === 'light' ? 'is-active' : ''} onClick={() => changeMode('light')} title="Light Mode" aria-label="Light Mode">☀</button>
      </div>
      <select className="theme-picker" value={palette} onChange={event => changePalette(event.target.value)} aria-label="Farbpalette">
        {THEME_PALETTES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
  );
}
