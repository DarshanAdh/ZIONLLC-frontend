const API = (() => {
  const BASE_URL = window.RUNTIME_CONFIG?.API_BASE_URL || 'https://zion-backend-production.up.railway.app/api';

  const getToken = () => localStorage.getItem('zion_token');
  const setToken = (t) => localStorage.setItem('zion_token', t);
  const clearToken = () => localStorage.removeItem('zion_token');
  const getUser = () => JSON.parse(localStorage.getItem('zion_user') || 'null');
  const setUser = (u) => localStorage.setItem('zion_user', JSON.stringify(u));
  const clearUser = () => localStorage.removeItem('zion_user');

  async function request(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  // Auth
  async function signup(payload) {
    const data = await request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
    setToken(data.token);
    setUser(data.user);
    return data;
  }
  async function login(payload) {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    setToken(data.token);
    setUser(data.user);
    return data;
  }
  function logout() { clearToken(); clearUser(); }
  function isLoggedIn() { return !!getToken(); }

  // Tracking
  const trackPackage = (id) => request(`/tracking/${id}`);
  const updateTracking = (id, body) => request(`/tracking/${id}/update`, { method: 'POST', body: JSON.stringify(body) });
  const manageDelivery = (id, body) => request(`/tracking/${id}/manage`, { method: 'PATCH', body: JSON.stringify(body) });

  // Shipments
  const calculatePrice = (weight, serviceType) => request('/shipments/calculate', { method: 'POST', body: JSON.stringify({ weight, serviceType }) });
  const createShipment = (payload) => request('/shipments', { method: 'POST', body: JSON.stringify(payload) });
  const getMyShipments = () => request('/shipments');
  const getShipment = (id) => request(`/shipments/${id}`);
  const cancelShipment = (id) => request(`/shipments/${id}/cancel`, { method: 'PATCH' });

  // Pickups
  const schedulePickup = (payload) => request('/pickups', { method: 'POST', body: JSON.stringify(payload) });
  const getMyPickups = () => request('/pickups');
  const modifyPickup = (id, body) => request(`/pickups/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  const cancelPickup = (id) => request(`/pickups/${id}`, { method: 'DELETE' });

  // Locations
  const searchLocations = (q = {}) => request(`/locations${Object.keys(q).length ? `?${new URLSearchParams(q)}` : ''}`);
  const getLocation = (id) => request(`/locations/${id}`);

  // Support
  const submitTicket = (payload) => request('/support', { method: 'POST', body: JSON.stringify(payload) });
  const getMyTickets = () => request('/support/my-tickets');
  const getFAQ = () => request('/support/faq');

  // Users
  const getProfile = () => request('/users/profile');
  const updateProfile = (body) => request('/users/profile', { method: 'PATCH', body: JSON.stringify(body) });
  const changePassword = (body) => request('/users/password', { method: 'PATCH', body: JSON.stringify(body) });
  const getAddresses = () => request('/users/addresses');
  const addAddress = (body) => request('/users/addresses', { method: 'POST', body: JSON.stringify(body) });
  const deleteAddress = (id) => request(`/users/addresses/${id}`, { method: 'DELETE' });

  return {
    signup, login, logout, isLoggedIn, getUser, getToken,
    trackPackage, updateTracking, manageDelivery,
    calculatePrice, createShipment, getMyShipments, getShipment, cancelShipment,
    schedulePickup, getMyPickups, modifyPickup, cancelPickup,
    searchLocations, getLocation,
    submitTicket, getMyTickets, getFAQ,
    getProfile, updateProfile, changePassword, getAddresses, addAddress, deleteAddress,
  };
})();
