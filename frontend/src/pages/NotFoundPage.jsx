import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <p className="text-xl font-semibold text-gray-700 mt-2">Page not found</p>
        <Link to="/dashboard" className="btn-primary mt-6 inline-flex">Go to Dashboard</Link>
      </div>
    </div>
  );
}
