import { describe, it, expect } from 'vitest';
import { formatPriceINR, formatDateTime, resolveImageUrl } from '../utils/formatters';

describe('Frontend Formatters and Utilities', () => {
  describe('formatPriceINR', () => {
    it('handles undefined, null, or NaN inputs gracefully', () => {
      expect(formatPriceINR(undefined as any)).toBe('₹0');
      expect(formatPriceINR(null as any)).toBe('₹0');
      expect(formatPriceINR(NaN)).toBe('₹0');
    });

    it('formats rental prices with / mo suffix', () => {
      expect(formatPriceINR(65000, 'rent')).toBe('₹65,000 / mo');
      expect(formatPriceINR(110000, 'rent')).toBe('₹1,10,000 / mo');
    });

    it('formats sale prices in Crores (Cr) when >= 10,000,000', () => {
      expect(formatPriceINR(48500000)).toBe('₹4.85 Cr');
      expect(formatPriceINR(10000000)).toBe('₹1 Cr');
      expect(formatPriceINR(32000000)).toBe('₹3.20 Cr');
    });

    it('formats sale prices in Lakhs when >= 100,000 and < 10,000,000', () => {
      expect(formatPriceINR(8500000)).toBe('₹85 Lakh');
      expect(formatPriceINR(4550000)).toBe('₹45.50 Lakh');
      expect(formatPriceINR(500000)).toBe('₹5 Lakh');
    });

    it('formats lower prices with standard Indian comma grouping', () => {
      expect(formatPriceINR(75000)).toBe('₹75,000');
    });
  });

  describe('formatDateTime', () => {
    it('returns N/A for empty date values', () => {
      expect(formatDateTime('')).toBe('N/A');
      expect(formatDateTime(null as any)).toBe('N/A');
    });

    it('returns Invalid Date for malformed strings', () => {
      expect(formatDateTime('invalid-date-format')).toBe('Invalid Date');
    });

    it('formats valid ISO dates', () => {
      const formatted = formatDateTime('2026-11-15T10:30:00Z');
      expect(formatted).not.toBe('N/A');
      expect(formatted).not.toBe('Invalid Date');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(5);
    });
  });

  describe('resolveImageUrl', () => {
    it('returns empty string for missing url', () => {
      expect(resolveImageUrl()).toBe('');
      expect(resolveImageUrl('')).toBe('');
    });

    it('preserves absolute URLs starting with http://, https://, or data:', () => {
      const httpUrl = 'http://example.com/photo.jpg';
      const httpsUrl = 'https://images.unsplash.com/photo-123';
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo';

      expect(resolveImageUrl(httpUrl)).toBe(httpUrl);
      expect(resolveImageUrl(httpsUrl)).toBe(httpsUrl);
      expect(resolveImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('returns relative url if no external API base is configured', () => {
      const relative = '/uploads/sample.jpg';
      expect(resolveImageUrl(relative)).toBe(relative);
    });
  });
});
