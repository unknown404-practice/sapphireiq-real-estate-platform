import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Property } from '../types';
import { X, Calendar, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ViewingModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export const ViewingModal: React.FC<ViewingModalProps> = ({ property, isOpen, onClose }) => {
  const { user } = useAuth();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('11:00');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Escape key listener for modal dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Minimum date should be tomorrow in user's local timezone (prevent UTC midnight drift)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const minDateStr = `${year}-${month}-${day}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date || !time) {
      setError('Please select both a date and time for the viewing.');
      return;
    }

    const scheduledDate = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledDate.getTime())) {
      setError('Please select a valid date and time.');
      return;
    }
    const scheduledAt = scheduledDate.toISOString();

    setLoading(true);
    try {
      if (user) {
        // Authenticated booking
        const res = await api.appointments.createAuth({
          property: property._id,
          scheduledAt,
          phone: guestPhone || user.phone,
          notes,
        });

        if (res.success) {
          setSuccess(true);
        } else {
          setError(res.error || 'Failed to schedule appointment');
        }
      } else {
        // Guest booking
        if (!guestName || !guestEmail || !guestPhone) {
          setError('Please fill in your name, email, and phone number.');
          setLoading(false);
          return;
        }

        const res = await api.appointments.createGuest({
          property: property._id,
          guestName,
          guestEmail,
          guestPhone,
          scheduledAt,
          notes,
        });

        if (res.success) {
          setSuccess(true);
        } else {
          setError(res.error || 'Failed to book guest appointment');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close viewing modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 id="modal-title" className="text-xl font-bold text-slate-900 mb-2">Viewing Scheduled!</h3>
            <p className="text-sm text-slate-600 mb-6">
              Your site visit request for <strong className="text-slate-800">{property.title}</strong> on{' '}
              <span className="font-semibold text-sapphire-600">{date} at {time}</span> has been submitted. Our property executive will connect with you to confirm access.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-sapphire-600 text-white rounded-xl font-medium hover:bg-sapphire-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-sapphire-100 text-sapphire-700 rounded-xl">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 id="modal-title" className="text-lg font-bold text-slate-900">Schedule a Viewing</h3>
                <p className="text-xs text-slate-500 truncate max-w-[320px]">{property.title}</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date & Time selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Date *
                  </label>
                  <input
                    type="date"
                    min={minDateStr}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Time *
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Guest Fields if not signed in */}
              {!user ? (
                <>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                    Booking as a guest. Please share contact information to receive appointment confirmation.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                      <input
                        type="email"
                        placeholder="ramesh@example.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                      <input
                        type="tel"
                        placeholder="+91 9876543210"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    placeholder={user.phone || '+91 9876543210'}
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Logged in as {user.name} ({user.email})</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Special Requirements / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Interested in seeing the clubhouse and parking as well."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sapphire-500 focus:border-sapphire-500"
                ></textarea>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-sapphire-600 hover:bg-sapphire-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Appointment...</span>
                  </>
                ) : (
                  <span>Request Viewing Appointment</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
