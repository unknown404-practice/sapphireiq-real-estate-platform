import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Property } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatPriceINR, resolveImageUrl } from '../utils/formatters';
import { ViewingModal } from '../components/ViewingModal';
import {
  Bed,
  Bath,
  Square,
  MapPin,
  Calendar,
  CheckCircle,
  ArrowLeft,
  Edit,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  User as UserIcon,
} from 'lucide-react';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80';

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isViewingModalOpen, setIsViewingModalOpen] = useState(false);

  useEffect(() => {
    async function loadProperty() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const res = await api.properties.getById(id);
        if (res.success && res.data) {
          setProperty(res.data);
        } else {
          setError(res.error || 'Property not found or unavailable');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading property details');
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-sapphire-600 mb-3" />
        <p className="text-sm">Loading property particulars...</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Property Unavailable</h2>
          <p className="text-sm text-slate-600">{error || 'This listing may have been removed or archived.'}</p>
          <div className="pt-2">
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sapphire-600 text-white rounded-xl text-sm font-semibold hover:bg-sapphire-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Properties</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const images = property.images && property.images.length > 0 ? property.images : [{ url: DEFAULT_IMAGE, caption: 'Primary View' }];
  const currentImage = images[selectedImageIndex] || images[0];

  const ownerObj = typeof property.owner === 'object' && property.owner !== null ? property.owner : null;
  const isOwner = user && ownerObj && ownerObj._id === user.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button and Owner Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-sapphire-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to search</span>
        </button>

        {isOwner && (
          <Link
            to={`/properties/${property._id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sapphire-50 border border-sapphire-200 text-sapphire-700 hover:bg-sapphire-100 rounded-xl text-xs font-semibold transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit My Property</span>
          </Link>
        )}
      </div>

      {/* Main Grid: Gallery & Information */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Photos & Full Description */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Featured Photo */}
          <div className="aspect-[16/10] bg-slate-900 rounded-2xl overflow-hidden shadow-sm relative group">
            <img
              src={resolveImageUrl(currentImage.url)}
              alt={currentImage.caption || property.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
              }}
            />
            {currentImage.caption && (
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg">
                {currentImage.caption}
              </div>
            )}
          </div>

          {/* Thumbnail Gallery (Up to 4 images) */}
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all ${
                    idx === selectedImageIndex
                      ? 'border-sapphire-600 shadow-md ring-2 ring-sapphire-600/20'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={resolveImageUrl(img.url)}
                    alt={img.caption || `Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Key Specifications Bar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="border-r last:border-none border-slate-100 p-2">
              <span className="block text-xs text-slate-500 mb-1">Property Type</span>
              <span className="font-bold text-slate-800 capitalize text-sm">{property.propertyType}</span>
            </div>
            <div className="border-r last:border-none border-slate-100 p-2">
              <span className="block text-xs text-slate-500 mb-1">Bedrooms</span>
              <div className="flex items-center justify-center gap-1.5 font-bold text-slate-800 text-sm">
                <Bed className="w-4 h-4 text-sapphire-500" />
                <span>{property.bedrooms ?? 'N/A'} Beds</span>
              </div>
            </div>
            <div className="border-r last:border-none border-slate-100 p-2">
              <span className="block text-xs text-slate-500 mb-1">Bathrooms</span>
              <div className="flex items-center justify-center gap-1.5 font-bold text-slate-800 text-sm">
                <Bath className="w-4 h-4 text-sapphire-500" />
                <span>{property.bathrooms ?? 'N/A'} Baths</span>
              </div>
            </div>
            <div className="p-2">
              <span className="block text-xs text-slate-500 mb-1">Super Area</span>
              <div className="flex items-center justify-center gap-1.5 font-bold text-slate-800 text-sm">
                <Square className="w-4 h-4 text-sapphire-500" />
                <span>{property.areaSqFt ? `${property.areaSqFt} sq.ft` : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">About this Property</h2>
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {property.description}
            </div>
          </div>

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Amenities & Features</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Sticky Booking & Contact Card */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {/* Header / Badges */}
            <div className="flex items-center justify-between">
              <span
                className={`px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${
                  property.listingType === 'rent'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sapphire-100 text-sapphire-800'
                }`}
              >
                For {property.listingType}
              </span>
              <span className="text-xs text-slate-500">ID: {property._id.slice(-6).toUpperCase()}</span>
            </div>

            {/* Price */}
            <div>
              <span className="block text-xs text-slate-500 font-medium">Offered Price</span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">
                {formatPriceINR(property.price, property.listingType)}
              </div>
            </div>

            {/* Title & Location */}
            <div className="space-y-1.5 pb-4 border-b border-slate-100">
              <h1 className="text-xl font-bold text-slate-800 leading-snug">{property.title}</h1>
              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin className="w-4 h-4 text-sapphire-500 flex-shrink-0 mt-0.5" />
                <span>
                  {property.locality ? `${property.locality}, ` : ''}{property.city}, {property.state}{' '}
                  {property.pincode ? `- ${property.pincode}` : ''}
                </span>
              </div>
            </div>

            {/* Book Viewing CTA or Owner Edit */}
            {isOwner ? (
              <div className="space-y-2">
                <div className="p-3 bg-sapphire-50 border border-sapphire-200 rounded-xl text-center text-xs text-sapphire-800 font-medium">
                  You are the owner of this property listing.
                </div>
                <Link
                  to={`/properties/${property._id}/edit`}
                  className="w-full py-3 px-4 bg-sapphire-600 hover:bg-sapphire-700 text-white font-semibold rounded-xl transition-all shadow flex items-center justify-center gap-2 text-sm"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Listing Particulars</span>
                </Link>
              </div>
            ) : (
              <button
                onClick={() => setIsViewingModalOpen(true)}
                className="w-full py-3.5 px-4 bg-sapphire-600 hover:bg-sapphire-700 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group"
              >
                <Calendar className="w-5 h-5 text-sapphire-200 group-hover:scale-110 transition-transform" />
                <span>Schedule a Viewing Visit</span>
              </button>
            )}

            {/* Owner / Agent Information */}
            {ownerObj && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Listing Agent / Owner</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                    <UserIcon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">{ownerObj.name}</p>
                    <p className="text-slate-500">Verified Seller Account</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ownerObj.email}</span>
                  </div>
                  {ownerObj.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ownerObj.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Viewing Appointment Modal */}
      <ViewingModal
        property={property}
        isOpen={isViewingModalOpen}
        onClose={() => setIsViewingModalOpen(false)}
      />
    </div>
  );
};
