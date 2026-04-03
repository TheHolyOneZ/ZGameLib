import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { GameStatus, Platform } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPlaytime(mins: number): string {
  if (mins === 0) return "Never played";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export const STATUS_LABELS: Record<GameStatus, string> = {
  none: "Unset",
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  dropped: "Dropped",
  on_hold: "On Hold",
};

export const STATUS_COLORS: Record<GameStatus, string> = {
  none: "text-slate-500",
  backlog: "text-blue-400",
  playing: "text-green-400",
  completed: "text-accent-400",
  dropped: "text-red-400",
  on_hold: "text-yellow-400",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  steam: "Steam",
  epic: "Epic Games",
  gog: "GOG",
  custom: "Custom",
  ubisoft: "Ubisoft Connect",
};

export const COVER_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23111118'/%3E%3Cstop offset='100%25' stop-color='%230a0a0f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='300' height='400'/%3E%3Ccircle cx='150' cy='180' r='40' fill='none' stroke='%231a1a2e' stroke-width='2'/%3E%3Cpath d='M140 170 L140 190 L165 180Z' fill='%231a1a2e'/%3E%3C/svg%3E`;

export const PLATFORM_COLORS: Record<Platform, string> = {
  steam: "bg-sky-900/50 text-sky-300 border-sky-700/50",
  epic: "bg-slate-800/60 text-slate-300 border-slate-600/50",
  gog: "bg-violet-900/40 text-violet-300 border-violet-700/50",
  custom: "bg-accent-900/40 text-accent-300 border-accent-700/50",
  ubisoft: "bg-blue-900/50 text-blue-300 border-blue-700/50",
};

