import { useState, useEffect } from 'react';

/**
 * Custom hook to check user's authentication status.
 * It simply checks for the presence of the 'token' in localStorage.
 * @returns {boolean} - True if the user is authenticated, false otherwise.
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token); // The '!!' converts the string (or null) to a boolean
  }, []);

  return isAuthenticated;
};