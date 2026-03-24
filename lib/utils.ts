import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export function formatDate(isoDate: string, includeTime: boolean = false): string {
  try {
    const date = new Date(isoDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return isoDate; // Return original if invalid
    }

    if (includeTime) {
      // Format with both date and time
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
      });
      
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Los_Angeles',
      });
      
      return `${dateStr} at ${timeStr}`;
    } else {
      // Format date only
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
      });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return isoDate; // Return original if error occurs
  }
}


export function formatDateShort(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    
    if (isNaN(date.getTime())) {
      return isoDate;
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Los_Angeles',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return isoDate;
  }
}

function monthNameFromMm(mm: string): string {
  const m = Number(mm);
  if (m < 1 || m > 12) return "-";
  return new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" });
}

/**
 * Format a partial date stored as text:
 * - YYYY — year only
 * - YYYY-MM — year + month
 * - YYYY-MM-DD — full date
 * - MM-DD or --MM-DD — month + day only (unknown year)
 *
 * Missing parts are shown as "-" when any part is unknown; full dates use a normal long form.
 */
export function formatPartialDate(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "";
  const v = value.trim();

  // Month + day only: --07-15 or 07-15
  if (/^--\d{2}-\d{2}$/.test(v)) {
    const [, , mm, dd] = v.split("-");
    return `- / ${monthNameFromMm(mm)} / ${String(Number(dd))}`;
  }
  if (/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)) {
    const [mm, dd] = v.split("-");
    return `- / ${monthNameFromMm(mm)} / ${String(Number(dd))}`;
  }

  // Full date — all parts known
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const date = new Date(v + "T12:00:00");
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/Los_Angeles",
      });
    }
  }

  // Year only
  if (/^\d{4}$/.test(v)) {
    return `${v} / - / -`;
  }

  // Year + month
  if (/^\d{4}-\d{2}$/.test(v)) {
    const [y, mm] = v.split("-");
    return `${y} / ${monthNameFromMm(mm)} / -`;
  }

  return v;
}
