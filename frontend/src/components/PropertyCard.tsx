import React from 'react';
import { Link } from 'react-router-dom';
import { Property } from '../types';
import { formatPriceINR, resolveImageUrl } from '../utils/formatters';
import { Bed, Bath, Square, MapPin, Eye } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const primaryImage = property.images && property.images.length > 0 ? resolveImageUrl(property.images[0].url) : DEFAULT_IMAGE;

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group">
      {/* Image container */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img
          src={primaryImage}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm uppercase tracking-wider ${
              property.listingType === 'rent'
                ? 'bg-amber-500 text-white'
                : 'bg-sapphire-600 text-white'
            }`}
          >
            For {property.listingType}
          </span>
          <span className="px-2.5 py-1 text-xs font-medium rounded-md shadow-sm bg-slate-900/80 text-white backdrop-blur-sm capitalize">
            {property.propertyType}
          </span>
        </div>

        {property.featured && (
          <div className="absolute top-3 right-3 bg-amber-400 text-slate-900 font-bold text-xs px-2 py-0.5 rounded shadow">
            Featured
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Price */}
          <div className="text-xl font-bold text-slate-900 mb-1">
            {formatPriceINR(property.price, property.listingType)}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-800 text-base line-clamp-1 group-hover:text-sapphire-600 transition-colors">
            {property.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <MapPin className="w-3.5 h-3.5 text-sapphire-500 flex-shrink-0" />
            <span className="truncate">
              {property.locality ? `${property.locality}, ` : ''}{property.city}
            </span>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-3 gap-2 py-3 mt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.bedrooms ?? 0} Beds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.bathrooms ?? 0} Baths</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.areaSqFt ? `${property.areaSqFt} sq.ft` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* View Details Link */}
        <Link
          to={`/properties/${property._id}`}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-50 hover:bg-sapphire-50 text-slate-700 hover:text-sapphire-600 border border-slate-200 hover:border-sapphire-200 text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>View Details & Book</span>
        </Link>
      </div>
    </div>
  );
};
