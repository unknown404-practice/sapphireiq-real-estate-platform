import React from 'react';
import { Building2, ShieldCheck, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-xl">
              <Building2 className="w-6 h-6 text-sapphire-400" />
              <span>Sapphire<span className="text-sapphire-400">IQ</span></span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              India's trusted intelligent real estate discovery platform. Direct viewing appointments, verified sellers, and transparent pricing in Indian Rupees.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Verified Property Listings</span>
            </div>
          </div>

          {/* Major Indian Cities */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Top Indian Markets</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/properties?city=Mumbai" className="hover:text-sapphire-400 flex items-center gap-1.5 transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Mumbai MMR
                </Link>
              </li>
              <li>
                <Link to="/properties?city=Bengaluru" className="hover:text-sapphire-400 flex items-center gap-1.5 transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Bengaluru Tech Corridors
                </Link>
              </li>
              <li>
                <Link to="/properties?city=Gurugram" className="hover:text-sapphire-400 flex items-center gap-1.5 transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Delhi NCR & Gurugram
                </Link>
              </li>
              <li>
                <Link to="/properties?city=Kolkata" className="hover:text-sapphire-400 flex items-center gap-1.5 transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Kolkata Heritage & Newtown
                </Link>
              </li>
              <li>
                <Link to="/properties?city=Hyderabad" className="hover:text-sapphire-400 flex items-center gap-1.5 transition-colors">
                  <MapPin className="w-3.5 h-3.5" /> Hyderabad HITEC City
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Platform Links</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/properties?listingType=sale" className="hover:text-white transition-colors">Properties for Sale</Link>
              </li>
              <li>
                <Link to="/properties?listingType=rent" className="hover:text-white transition-colors">Rental Homes</Link>
              </li>
              <li>
                <Link to="/properties/new" className="hover:text-white transition-colors">Post Your Property</Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">Client Dashboard</Link>
              </li>
            </ul>
          </div>

          {/* Trust & Guarantee */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Viewing Assurance</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Schedule verified site visits directly with owners and certified property advisors. No spam, immediate confirmation.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-4 h-4 text-sapphire-400" />
              <span>Real-time appointment calendar</span>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} SapphireIQ Real Estate Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>RERA Compliant Discovery</span>
            <span>&bull;</span>
            <span>Verified Indian Properties Only</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
