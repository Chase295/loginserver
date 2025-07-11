// Use an empty string as default for REACT_APP_API_URL.
// This makes API calls relative to the domain the frontend is served from.
// e.g. if app is at yourdomain.com, API call to '/api/login' becomes 'yourdomain.com/api/login'
// If REACT_APP_API_URL is explicitly set (e.g. to 'http://localhost:8000' for local dev not using a proxy,
// or 'https://api.yourdomain.com' for a different API domain), it will use that.
export const API_URL = process.env.REACT_APP_API_URL || '';