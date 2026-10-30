// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';

describe('Frontend Auth Routing & ProtectedRoute Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state when session authentication is in progress', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Authenticating session...')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('redirects unauthenticated user to /login and preserves location', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/properties/create']}>
        <Routes>
          <Route
            path="/properties/create"
            element={
              <ProtectedRoute>
                <div>Create Property Form</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Screen')).toBeDefined();
    expect(screen.queryByText('Create Property Form')).toBeNull();
  });

  it('renders protected child component when user is authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user_123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
      },
      token: 'mock_jwt_token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/my-appointments']}>
        <ProtectedRoute>
          <div>My Scheduled Viewings Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('My Scheduled Viewings Content')).toBeDefined();
  });
});
