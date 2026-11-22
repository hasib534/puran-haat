import type { AuctionRecord } from './models';

export function relativeTime(timestamp: number | undefined | null): string {
  if (!timestamp) return '—';
  const delta = Date.now() - timestamp;
  if (delta < 0) return startsIn(timestamp);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(timestamp);
}

export function formatDate(timestamp: number | undefined | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp: number | undefined | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function startsIn(timestamp: number): string {
  const delta = timestamp - Date.now();
  if (delta <= 0) return 'Started';
  const minutes = Math.ceil(delta / 60_000);
  if (minutes < 60) return `Starts in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Starts in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `Starts in ${days} day${days === 1 ? '' : 's'}`;
}

/** `HH:MM:SS` left in an auction window, or null once it has closed. */
export function auctionCountdown(auction: AuctionRecord, now = Date.now()): string | null {
  const endsAt = auction.starts_at + auction.duration_hours * 3_600_000;
  const remaining = endsAt - now;
  if (remaining <= 0) return null;
  const total = Math.floor(remaining / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function riskLabel(score: number): { label: string; tone: 'ok' | 'warn' | 'high' } {
  if (score >= 50) return { label: `High Risk (${score})`, tone: 'high' };
  if (score >= 20) return { label: `Medium Risk (${score})`, tone: 'warn' };
  return { label: `Low Risk (${score})`, tone: 'ok' };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function memberSince(joinedAt: number | undefined): string {
  return joinedAt ? `Joined ${formatDate(joinedAt)}` : 'Join date unknown';
}

export function formatPoints(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value));
}

/** `2026-11-24T14:30` for <input type="datetime-local">. */
export function toDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}