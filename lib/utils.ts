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
