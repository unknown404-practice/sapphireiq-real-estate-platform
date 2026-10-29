/**
 * Formats a price in Indian Rupees (INR) with Indian numbering conventions.
 */
export function formatPriceINR(price: number, listingType?: 'sale' | 'rent'): string {
  if (price === undefined || price === null || isNaN(price)) {
    return '₹0';
  }

  let formatted = '';

  if (listingType === 'rent') {
    formatted = `₹${price.toLocaleString('en-IN')} / mo`;
  } else if (price >= 10000000) {
    const crores = price / 10000000;
    formatted = `₹${crores.toFixed(2).replace(/\.00$/, '')} Cr`;
  } else if (price >= 100000) {
    const lakhs = price / 100000;
    formatted = `₹${lakhs.toFixed(2).replace(/\.00$/, '')} Lakh`;
  } else {
    formatted = `₹${price.toLocaleString('en-IN')}`;
  }

  return formatted;
}

/**
 * Formats an ISO date string into human readable Indian standard date and time.
 */
export function formatDateTime(dateStr: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';

  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Resolves an image URL so relative local uploads (/uploads/...) point to the backend origin.
 * In production when backend is deployed on Render and frontend on Vercel, this prefixes
 * relative image paths with the backend host URL while preserving absolute CDN (ImageKit) URLs.
 */
export function resolveImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    const rawApiBase = import.meta.env.VITE_API_BASE_URL || '';
    if (rawApiBase.startsWith('http://') || rawApiBase.startsWith('https://')) {
      const backendOrigin = rawApiBase.replace(/\/api\/?$/, '');
      return `${backendOrigin}${url}`;
    }
  }
  return url;
}
