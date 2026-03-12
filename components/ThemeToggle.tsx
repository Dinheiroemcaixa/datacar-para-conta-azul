'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 p-2 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-md hover:scale-110 transition-transform cursor-pointer z-50 text-2xl"
      aria-label="Alternar tema"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
