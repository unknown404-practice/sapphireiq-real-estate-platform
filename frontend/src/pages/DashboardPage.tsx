import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Property, Appointment } from '../types';
import { formatPriceINR, formatDateTime, resolveImageUrl } from '../utils/formatters';
import {
  Building2,
  Calendar,
  PlusCircle,
  Edit,
  Trash2,
  ExternalLink,
  XCircle,
  Loader2,
  AlertCircle,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'properties' | 'appointments'>('properties');
  const [properties, setProperties] = useState<Property[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [loadingProps, setLoadingProps] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Load user properties
  const loadProperties = async () => {
    setLoadingProps(true);
    try {
      const res = await api.properties.getMyProperties();
      if (res.success && res.data) {
        setProperties(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load user properties:', err);
    } finally {
      setLoadingProps(false);
    }
  };

  // Load user appointments
  const loadAppointments = async () => {
    setLoadingAppts(true);
    try {
      const res = await api.appointments.getMyAppointments();
      if (res.success && res.data) {
        setAppointments(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load user appointments:', err);
    } finally {
      setLoadingAppts(false);
    }
  };

  useEffect(() => {
    loadProperties();
    loadAppointments();
  }, []);

  const handleDeleteProperty = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this property listing?')) {
      return;
    }

    setDeletingId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.properties.delete(id);
      if (res.success) {
        setProperties(properties.filter((p) => p._id !== id));
        setActionSuccess('Property deleted successfully.');
      } else {
        setActionError(res.error || 'Failed to delete property.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error occurred while deleting property.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this viewing appointment?')) {
      return;
    }

    setCancellingId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.appointments.cancel(id);
      if (res.success && res.data) {
        setAppointments(
          appointments.map((a) => (a._id === id ? { ...a, status: 'cancelled' } : a))
        );
        setActionSuccess('Viewing appointment cancelled.');
      } else {
        setActionError(res.error || 'Failed to cancel appointment.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error occurred while cancelling appointment.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'confirmed' | 'completed' | 'cancelled') => {
    setStatusUpdatingId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.appointments.updateStatus(id, status);
      if (res.success && res.data) {
        setAppointments(
          appointments.map((a) => (a._id === id ? { ...a, status } : a))
        );
        setActionSuccess(`Appointment status successfully marked as ${status}.`);
      } else {
        setActionError(res.error || `Failed to update status to ${status}.`);
      }
    } catch (err: any) {
      setActionError(err.message || 'Error occurred while updating appointment.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Profile Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-sapphire-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{user?.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sapphire-50 text-sapphire-700 border border-sapphire-200 capitalize">
                {user?.role}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{user?.email}</p>
            {user?.phone && <p className="text-xs text-slate-400">{user?.phone}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/properties/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sapphire-600 hover:bg-sapphire-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>List New Property</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('properties')}
            className={`pb-3 px-5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'properties'
                ? 'border-sapphire-600 text-sapphire-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>My Property Listings ({properties.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={`pb-3 px-5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'appointments'
                ? 'border-sapphire-600 text-sapphire-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Viewing Appointments ({appointments.length})</span>
          </button>
        </div>

        {/* Tab 1: Properties */}
        {activeTab === 'properties' && (
          <div>
            {loadingProps ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-sapphire-600 mb-2" />
                <p className="text-sm">Fetching your properties...</p>
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">You haven't listed any properties yet</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  List your residential or commercial properties to connect with verified buyers and tenants.
                </p>
                <Link
                  to="/properties/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sapphire-600 text-white rounded-xl text-sm font-semibold hover:bg-sapphire-700"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>List Your First Property</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((prop) => (
                  <div
                    key={prop._id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/10] bg-slate-100 relative">
                        <img
                          src={resolveImageUrl(prop.images?.[0]?.url) || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}
                          alt={prop.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-sapphire-600 text-white">
                            {prop.listingType}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-900/80 text-white">
                            {prop.status}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="text-base font-bold text-slate-900">
                          {formatPriceINR(prop.price, prop.listingType)}
                        </div>
                        <h3 className="font-semibold text-sm text-slate-800 line-clamp-1">
                          {prop.title}
                        </h3>
                        <p className="text-xs text-slate-500">{prop.locality ? `${prop.locality}, ` : ''}{prop.city}</p>
                      </div>
                    </div>

                    <div className="p-4 pt-0 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                      <Link
                        to={`/properties/${prop._id}`}
                        className="p-2 text-slate-600 hover:text-sapphire-600 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="View Public Page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Link>

                      <div className="flex items-center gap-1">
                        <Link
                          to={`/properties/${prop._id}/edit`}
                          className="p-2 text-slate-600 hover:text-sapphire-600 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Edit Property"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDeleteProperty(prop._id)}
                          disabled={deletingId === prop._id}
                          className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Delete Listing"
                        >
                          {deletingId === prop._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Appointments */}
        {activeTab === 'appointments' && (
          <div>
            {loadingAppts ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-sapphire-600 mb-2" />
                <p className="text-sm">Fetching appointments...</p>
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">No scheduled viewing appointments</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  Browse available properties to request site visits or schedule in-person tours.
                </p>
                <Link
                  to="/properties"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sapphire-600 text-white rounded-xl text-sm font-semibold hover:bg-sapphire-700"
                >
                  Explore Properties
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appt) => {
                  const propObj = typeof appt.property === 'object' && appt.property !== null ? appt.property : null;
                  const isOwner = Boolean(
                    user && (
                      (propObj && (
                        typeof propObj.owner === 'object' && propObj.owner !== null
                          ? (propObj.owner as any)._id === user.id
                          : (propObj.owner as any) === user.id
                      )) ||
                      (appt.propertyOwner && (
                        typeof appt.propertyOwner === 'object'
                          ? (appt.propertyOwner as any)._id === user.id
                          : appt.propertyOwner === user.id
                      ))
                    )
                  );

                  return (
                    <div
                      key={appt._id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              appt.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : appt.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : appt.status === 'cancelled'
                                ? 'bg-slate-100 text-slate-500 line-through'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {appt.status}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            Scheduled: <strong className="text-slate-800">{formatDateTime(appt.scheduledAt)}</strong>
                          </span>
                        </div>

                        {propObj ? (
                          <div className="space-y-0.5">
                            <Link
                              to={`/properties/${propObj._id}`}
                              className="text-base font-bold text-slate-900 hover:text-sapphire-600 transition-colors"
                            >
                              {propObj.title}
                            </Link>
                            <p className="text-xs text-slate-500">{propObj.locality ? `${propObj.locality}, ` : ''}{propObj.city}</p>
                          </div>
                        ) : (
                          (appt.propertyTitle || appt.propertyCity) && (
                            <div className="space-y-0.5">
                              <span className="text-base font-bold text-slate-700">
                                {appt.propertyTitle || 'Archived Property'}
                              </span>
                              {appt.propertyCity && (
                                <p className="text-xs text-slate-500">{appt.propertyCity} (Listing no longer active)</p>
                              )}
                            </div>
                          )
                        )}

                        {appt.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-xl">
                            <strong>Note:</strong> {appt.notes}
                          </p>
                        )}

                        {appt.guestName && (
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span>Visitor: {appt.guestName} ({appt.guestEmail || 'No email'})</span>
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-end gap-2 justify-between">
                        {isOwner && appt.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(appt._id, 'confirmed')}
                            disabled={statusUpdatingId === appt._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {statusUpdatingId === appt._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Confirm Visit</span>
                          </button>
                        )}

                        {isOwner && appt.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(appt._id, 'completed')}
                            disabled={statusUpdatingId === appt._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {statusUpdatingId === appt._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Mark Completed</span>
                          </button>
                        )}

                        {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(appt._id)}
                            disabled={cancellingId === appt._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {cancellingId === appt._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>Cancel Booking</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
