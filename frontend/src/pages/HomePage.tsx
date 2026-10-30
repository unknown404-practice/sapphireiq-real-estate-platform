import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Property } from '../types';
import { PropertyCard } from '../components/PropertyCard';
import { Search, MapPin, Building, Key, ShieldCheck, Calendar, ArrowRight, Loader2 } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const [city, setCity] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [propertyType, setPropertyType] = useState('');

  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await api.properties.getAll({ limit: 6 });
        if (res.success && res.data) {
          setFeaturedProperties(res.data);
        }
      } catch (err) {
        console.error('Failed to load featured properties:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) {
      // Set search for locality, city, title keyword matching
      params.append('search', city.trim());
    }
    if (listingType) params.append('listingType', listingType);
    if (propertyType) params.append('propertyType', propertyType);
    navigate(`/properties?${params.toString()}`);
  };

  const popularCities = ['Mumbai', 'Bengaluru', 'Delhi NCR', 'Kolkata', 'Hyderabad', 'Pune'];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-sapphire-950 text-white pt-20 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#36abf6_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sapphire-500/20 text-sapphire-300 border border-sapphire-400/30 text-xs font-semibold uppercase tracking-wider">
            <span>India's Premium Real Estate Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Discover Exceptional Homes <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sapphire-400 to-sky-200">
              Across Premier Indian Cities
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-300 text-base sm:text-lg">
            Explore verified luxury apartments, modern villas, and commercial real estate. Direct viewing bookings, transparent pricing in INR, and verified owners.
          </p>

          {/* Search Box */}
          <div className="mt-8 max-w-4xl mx-auto bg-white rounded-2xl p-3 sm:p-4 text-slate-800 shadow-2xl">
            {/* Buy / Rent Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setListingType('sale')}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
                  listingType === 'sale'
                    ? 'bg-sapphire-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Buy Properties
              </button>
              <button
                type="button"
                onClick={() => setListingType('rent')}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
                  listingType === 'rent'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Rent Homes
              </button>
            </div>

            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* City */}
              <div className="sm:col-span-5 relative">
                <MapPin className="w-5 h-5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Enter City, Locality (e.g. Mumbai, Whitefield)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500 text-slate-800"
                />
              </div>

              {/* Property Type */}
              <div className="sm:col-span-4 relative">
                <Building className="w-5 h-5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500 text-slate-700 bg-white"
                >
                  <option value="">All Property Types</option>
                  <option value="apartment">Apartment / Flat</option>
                  <option value="villa">Independent Villa</option>
                  <option value="house">Row House</option>
                  <option value="plot">Residential Plot</option>
                  <option value="commercial">Commercial Office</option>
                </select>
              </div>

              {/* Submit CTA */}
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full h-full py-2.5 px-4 bg-sapphire-600 hover:bg-sapphire-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
              </div>
            </form>

            {/* Popular City Quick Filter Pills */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Popular:</span>
              {popularCities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCity(c);
                    navigate(`/properties?city=${encodeURIComponent(c)}&listingType=${listingType}`);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-sapphire-50 hover:text-sapphire-600 text-slate-600 rounded-md transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Featured Real Estate</h2>
            <p className="text-slate-500 text-sm mt-1">
              Hand-picked premium verified listings available for immediate viewing
            </p>
          </div>
          <Link
            to="/properties"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sapphire-600 hover:text-sapphire-700 group"
          >
            <span>Browse all listings</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sapphire-600 mb-2" />
            <p className="text-sm">Loading properties...</p>
          </div>
        ) : featuredProperties.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No properties available yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Run the demo database seed or sign in to list your first Indian real estate property.
            </p>
            <Link
              to="/properties/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sapphire-600 text-white rounded-xl text-sm font-semibold hover:bg-sapphire-700"
            >
              Post a Property
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map((prop) => (
              <PropertyCard key={prop._id} property={prop} />
            ))}
          </div>
        )}
      </section>

      {/* Value Pillars */}
      <section className="bg-slate-100 py-16 px-4 sm:px-6 lg:px-8 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Why SapphireIQ?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Engineered to make Indian property buying, leasing, and viewings transparent and frictionless.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-start">
              <div className="p-3 bg-sapphire-100 text-sapphire-700 rounded-xl mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Owners</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Connect directly with property owners and authorized advisors. No ghost listings or speculative advertisements.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-start">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Direct Viewing Visits</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Schedule in-person site visits directly, whether you are registered or booking as a guest. Real-time slot management.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-start">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl mb-4">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Transparent INR Valuations</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Realistic pricing in Indian Crores and Lakhs with verified square footage, carpet area, and complete amenities documentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to action for owners */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-sapphire-700 to-indigo-800 rounded-3xl p-8 sm:p-12 text-white flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="space-y-3 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold">Are You a Property Owner or Builder?</h2>
            <p className="text-sapphire-100 text-sm max-w-xl">
              List your residential flats, luxury villas, or commercial properties in front of serious buyers and qualified tenants across India today.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/properties/new"
              className="px-6 py-3 bg-white text-sapphire-700 hover:bg-sapphire-50 font-bold rounded-xl transition-colors shadow"
            >
              List Your Property Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
