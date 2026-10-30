import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Property, Pagination, FilterParams } from '../types';
import { PropertyCard } from '../components/PropertyCard';
import {
  Search,
  Filter,
  SlidersHorizontal,
  RotateCcw,
  Building,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const PropertiesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state initialized from URL query params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [listingType, setListingType] = useState(searchParams.get('listingType') || '');
  const [propertyType, setPropertyType] = useState(searchParams.get('propertyType') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const [properties, setProperties] = useState<Property[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Sync state with URL params when URL changes
  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setCity(searchParams.get('city') || '');
    setListingType(searchParams.get('listingType') || '');
    setPropertyType(searchParams.get('propertyType') || '');
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
    setBedrooms(searchParams.get('bedrooms') || '');
    setSort(searchParams.get('sort') || 'newest');
    setPage(parseInt(searchParams.get('page') || '1', 10));
  }, [searchParams]);

  // Fetch properties whenever filter params change
  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      setError(null);

      const params: FilterParams = {
        search: searchParams.get('search') || undefined,
        city: searchParams.get('city') || undefined,
        listingType: searchParams.get('listingType') || undefined,
        propertyType: searchParams.get('propertyType') || undefined,
        minPrice: searchParams.get('minPrice') || undefined,
        maxPrice: searchParams.get('maxPrice') || undefined,
        bedrooms: searchParams.get('bedrooms') || undefined,
        sort: searchParams.get('sort') || 'newest',
        page: parseInt(searchParams.get('page') || '1', 10),
        limit: 12,
      };

      try {
        const res = await api.properties.getAll(params);
        if (res.success && res.data) {
          setProperties(res.data);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        } else {
          setError(res.error || 'Failed to retrieve properties');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching properties');
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [searchParams]);

  // Compute windowed page array (e.g. 1, 2, ..., current, ..., last)
  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | string)[] = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  };

  // Apply filters by writing to URL params
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (city) params.set('city', city);
    if (listingType) params.set('listingType', listingType);
    if (propertyType) params.set('propertyType', propertyType);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (bedrooms) params.set('bedrooms', bedrooms);
    if (sort) params.set('sort', sort);
    params.set('page', '1'); // Reset to page 1 on filter update

    setSearchParams(params);
    setShowFiltersMobile(false);
  };

  const resetFilters = () => {
    setSearch('');
    setCity('');
    setListingType('');
    setPropertyType('');
    setMinPrice('');
    setMaxPrice('');
    setBedrooms('');
    setSort('newest');
    setSearchParams(new URLSearchParams());
    setShowFiltersMobile(false);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header and Mobile Filter Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Verified Properties</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {pagination ? `${pagination.total} properties found` : 'Searching Indian real estate...'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>Filters</span>
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">Sort:</span>
            <select
              value={sort}
              onChange={(e) => {
                const nextSort = e.target.value;
                setSort(nextSort);
                const p = new URLSearchParams(searchParams);
                p.set('sort', nextSort);
                p.set('page', '1');
                setSearchParams(p);
              }}
              className="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="area_desc">Area: Largest First</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Filter Sidebar */}
        <aside
          className={`${
            showFiltersMobile ? 'block' : 'hidden'
          } md:block md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-20`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Filter className="w-4 h-4 text-sapphire-600" />
              <span>Filter Properties</span>
            </div>
            <button
              onClick={resetFilters}
              title="Reset all filters"
              className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Listing Type: All, Sale, Rent */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Listing Category
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setListingType('')}
                className={`py-1.5 rounded-lg transition-colors ${
                  listingType === '' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setListingType('sale')}
                className={`py-1.5 rounded-lg transition-colors ${
                  listingType === 'sale' ? 'bg-white text-sapphire-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setListingType('rent')}
                className={`py-1.5 rounded-lg transition-colors ${
                  listingType === 'rent' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rent
              </button>
            </div>
          </div>

          {/* Keyword / Locality */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Keyword / Locality
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Worli, Penthouse, Whitefield"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500 pl-8"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              City / Location
            </label>
            <input
              type="text"
              placeholder="e.g. Mumbai, Bengaluru"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
            />
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Property Type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500 bg-white"
            >
              <option value="">Any Type</option>
              <option value="apartment">Apartment</option>
              <option value="villa">Independent Villa</option>
              <option value="house">House</option>
              <option value="plot">Plot</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          {/* Bedrooms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Bedrooms (BHK)
            </label>
            <div className="grid grid-cols-5 gap-1.5 text-xs">
              {['', '1', '2', '3', '4'].map((b) => (
                <button
                  key={b || 'any'}
                  type="button"
                  onClick={() => setBedrooms(b)}
                  className={`py-2 text-center rounded-lg border font-semibold transition-colors ${
                    bedrooms === b
                      ? 'bg-sapphire-600 border-sapphire-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {b ? `${b}+` : 'Any'}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Price Range (INR)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min Price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sapphire-500"
              />
              <input
                type="number"
                placeholder="Max Price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sapphire-500"
              />
            </div>
          </div>

          {/* Apply button */}
          <button
            type="button"
            onClick={applyFilters}
            className="w-full py-2.5 px-4 bg-sapphire-600 hover:bg-sapphire-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </aside>

        {/* Results Grid */}
        <main className="md:col-span-3 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-sapphire-600 mb-3" />
              <p className="text-sm font-medium">Loading property listings...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col items-center text-center">
              <AlertCircle className="w-10 h-10 text-rose-600 mb-2" />
              <h3 className="font-bold text-rose-800 text-base">Error Loading Listings</h3>
              <p className="text-sm text-rose-600 mt-1 max-w-md">{error}</p>
              <button
                onClick={() => applyFilters()}
                className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">No properties match your filters</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Try widening your price boundaries, clearing selected amenities or choosing a different city.
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sapphire-600 text-white rounded-xl text-sm font-semibold hover:bg-sapphire-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All Filters</span>
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property) => (
                  <PropertyCard key={property._id} property={property} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Showing page <span className="font-semibold text-slate-700">{pagination.page}</span> of{' '}
                    <span className="font-semibold text-slate-700">{pagination.pages}</span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {getPageNumbers(page, pagination.pages).map((p, idx) =>
                      typeof p === 'string' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                            p === page
                              ? 'bg-sapphire-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= pagination.pages}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
