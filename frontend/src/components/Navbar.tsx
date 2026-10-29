import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, PlusCircle, LayoutDashboard, LogOut, LogIn, Menu, X, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-sapphire-600 hover:text-sapphire-700 font-bold text-xl tracking-tight">
            <Building2 className="w-7 h-7 text-sapphire-600" />
            <span>Sapphire<span className="text-slate-900">IQ</span></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/properties"
              className="text-sm font-medium text-slate-700 hover:text-sapphire-600 transition-colors"
            >
              Browse Properties
            </Link>

            {user ? (
              <>
                <Link
                  to="/properties/new"
                  className="flex items-center gap-1.5 text-sm font-medium text-sapphire-600 hover:text-sapphire-700 bg-sapphire-50 px-3.5 py-1.5 rounded-lg border border-sapphire-200 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  List Property
                </Link>

                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-sapphire-600 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>

                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <div className="w-8 h-8 rounded-full bg-sapphire-100 text-sapphire-700 font-semibold flex items-center justify-center text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium max-w-[120px] truncate">{user.name}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Log out"
                    className="p-1.5 text-slate-500 hover:text-rose-600 rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-sapphire-600 px-3 py-1.5 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium text-white bg-sapphire-600 hover:bg-sapphire-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3">
          <Link
            to="/properties"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-slate-800 hover:text-sapphire-600 py-1"
          >
            Browse Properties
          </Link>

          {user ? (
            <>
              <Link
                to="/properties/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-base font-medium text-sapphire-600 py-1"
              >
                <PlusCircle className="w-5 h-5" />
                List Property
              </Link>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-base font-medium text-slate-800 hover:text-sapphire-600 py-1"
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Link>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <UserIcon className="w-4 h-4 text-sapphire-600" />
                  <span className="font-semibold">{user.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm font-medium text-rose-600"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </>
          ) : (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center text-base font-medium text-slate-700 hover:text-sapphire-600 py-2"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center text-base font-medium text-white bg-sapphire-600 py-2 rounded-lg"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
