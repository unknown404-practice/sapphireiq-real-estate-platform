import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PropertyType, ListingType, PropertyImage } from '../types';
import { resolveImageUrl } from '../utils/formatters';
import {
  Upload,
  X,
  Plus,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';

const COMMON_AMENITIES = [
  'Swimming Pool',
  'Gymnasium',
  '24/7 Security',
  'Covered Parking',
  'Clubhouse',
  'Power Backup',
  'Private Garden',
  'Children Play Area',
  'Gated Community',
  'EV Charging Station',
  'High Speed Elevators',
  'Central Air Conditioning',
];

export const CreateEditPropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [listingType, setListingType] = useState<ListingType>('sale');
  const [price, setPrice] = useState<string>('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('');
  const [bedrooms, setBedrooms] = useState<string>('2');
  const [bathrooms, setBathrooms] = useState<string>('2');
  const [areaSqFt, setAreaSqFt] = useState<string>('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');

  const [images, setImages] = useState<PropertyImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  // If in edit mode, fetch existing property data
  useEffect(() => {
    if (!isEdit || !id) return;

    async function fetchProperty() {
      try {
        const res = await api.properties.getById(id!);
        if (res.success && res.data) {
          const p = res.data;
          // Check ownership
          const ownerId = typeof p.owner === 'object' && p.owner !== null ? p.owner._id : p.owner;
          if (user && ownerId && ownerId !== user.id && user.role !== 'admin') {
            setError('You do not have permission to edit this property');
            return;
          }

          setTitle(p.title);
          setDescription(p.description);
          setPropertyType(p.propertyType);
          setListingType(p.listingType);
          setPrice(String(p.price));
          setCity(p.city);
          setState(p.state);
          setLocality(p.locality || '');
          setPincode(p.pincode || '');
          setBedrooms(p.bedrooms !== undefined ? String(p.bedrooms) : '');
          setBathrooms(p.bathrooms !== undefined ? String(p.bathrooms) : '');
          setAreaSqFt(p.areaSqFt !== undefined ? String(p.areaSqFt) : '');
          setAmenities(p.amenities || []);
          setImages(p.images || []);
        } else {
          setError(res.error || 'Property not found');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching property');
      } finally {
        setFetchLoading(false);
      }
    }

    fetchProperty();
  }, [id, isEdit, user]);

  const toggleAmenity = (item: string) => {
    if (amenities.includes(item)) {
      setAmenities(amenities.filter((a) => a !== item));
    } else {
      setAmenities([...amenities, item]);
    }
  };

  const handleAddCustomAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmenity.trim() && !amenities.includes(customAmenity.trim())) {
      setAmenities([...amenities, customAmenity.trim()]);
      setCustomAmenity('');
    }
  };

  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 4 - images.length;
    if (remainingSlots <= 0) {
      setError('A maximum of 4 images can be uploaded per property.');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingImages(true);
    setError(null);

    try {
      const res = await api.properties.uploadImages(filesToUpload);
      if (res.success && res.data) {
        setImages([...images, ...res.data]);
      } else {
        setError(res.error || 'Failed to upload images');
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title || !description || !price || !city || !state) {
      setError('Please fill out all required fields.');
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setError('Please enter a valid price in INR.');
      return;
    }

    const payload = {
      title,
      description,
      propertyType,
      listingType,
      price: numericPrice,
      city,
      state,
      locality: locality || undefined,
      pincode: pincode || undefined,
      bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms, 10) : undefined,
      areaSqFt: areaSqFt ? parseFloat(areaSqFt) : undefined,
      amenities,
      images,
    };

    setLoading(true);

    try {
      if (isEdit && id) {
        const res = await api.properties.update(id, payload);
        if (res.success) {
          navigate(`/properties/${id}`);
        } else {
          setError(res.error || 'Failed to update property');
        }
      } else {
        const res = await api.properties.create(payload);
        if (res.success && res.data) {
          navigate(`/properties/${res.data._id}`);
        } else {
          setError(res.error || 'Failed to create property');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-sapphire-600 mb-3" />
        <p className="text-sm">Loading property data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-sapphire-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit Property Listing' : 'List a New Property'}
        </h1>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8">
        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Basic Particulars
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Property Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Spacious 3BHK Sea-Facing Apartment in Worli"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Listing Type *</label>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value as ListingType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500 bg-white"
              >
                <option value="sale">For Sale</option>
                <option value="rent">For Rent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Property Type *</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500 bg-white"
              >
                <option value="apartment">Apartment / Flat</option>
                <option value="villa">Independent Villa</option>
                <option value="house">Row House</option>
                <option value="plot">Plot</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Price in INR (₹) *
              </label>
              <input
                type="number"
                required
                min="0"
                placeholder={listingType === 'rent' ? 'e.g. 45000' : 'e.g. 15000000'}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
            <textarea
              required
              rows={4}
              placeholder="Highlight architectural aspects, floor layout, proximity to business hubs, natural lighting, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
            ></textarea>
          </div>
        </div>

        {/* Section 2: Location Information */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Location Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                placeholder="e.g. Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
              <input
                type="text"
                required
                placeholder="e.g. Maharashtra"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Locality / Neighborhood</label>
              <input
                type="text"
                placeholder="e.g. Bandra West, Whitefield"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                placeholder="e.g. 400050"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Specs & Measurements */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Specifications
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bedrooms</label>
              <input
                type="number"
                min="0"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bathrooms</label>
              <input
                type="number"
                min="0"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Super Area (Sq. Ft)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 1450"
                value={areaSqFt}
                onChange={(e) => setAreaSqFt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sapphire-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Property Images (Max 4) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">
              Photographs ({images.length}/4)
            </h2>
            <span className="text-xs text-slate-500">Maximum 4 images allowed (JPEG, PNG, WebP)</span>
          </div>

          {/* Current Images Preview */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 group">
                  <img src={resolveImageUrl(img.url)} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-1 left-2 text-[10px] text-white/90 bg-black/40 px-1.5 py-0.5 rounded">
                    Photo {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          {images.length < 4 && (
            <div className="border-2 border-dashed border-slate-300 hover:border-sapphire-400 rounded-2xl p-6 text-center transition-colors">
              <input
                type="file"
                id="image-upload"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFiles}
                disabled={uploadingImages}
                className="hidden"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-sapphire-50 text-sapphire-600 flex items-center justify-center">
                  {uploadingImages ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-sapphire-600 hover:underline">
                    {uploadingImages ? 'Uploading images...' : 'Click to upload property photos'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">Up to {4 - images.length} more images (max 5MB each)</p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Section 5: Amenities */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Amenities & Facilities
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COMMON_AMENITIES.map((item) => {
              const isSelected = amenities.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAmenity(item)}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-sapphire-50 border-sapphire-500 text-sapphire-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-sapphire-600 border-sapphire-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>

          {/* Add custom amenity */}
          <div className="flex gap-2 max-w-md pt-2">
            <input
              type="text"
              placeholder="Add other amenity (e.g. Squash Court)"
              value={customAmenity}
              onChange={(e) => setCustomAmenity(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500"
            />
            <button
              type="button"
              onClick={handleAddCustomAmenity}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploadingImages}
            className="px-6 py-2.5 bg-sapphire-600 hover:bg-sapphire-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Listing...</span>
              </>
            ) : (
              <span>{isEdit ? 'Update Property' : 'Publish Property Listing'}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
