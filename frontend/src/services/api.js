import axios from 'axios';

// Create a new axios instance with the backend's base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/**
 * Axios Request Interceptor
 * This function will be called before every request is sent.
 * It checks if a token exists in localStorage and, if so, adds it to the
 * 'Authorization' header. This automates the process of sending the
 * auth token with every protected API call.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Add the Bearer token to the request headers
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;