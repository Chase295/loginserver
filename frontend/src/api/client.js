import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Only redirect to login if we actually have a token that's invalid
      // Don't redirect for network errors or during initial auth check
      const url = err.config?.url || ''
      if (url.includes('/auth/me') || url.includes('/auth/plex')) {
        // Auth check failed — just reject, AuthContext handles it
        return Promise.reject(err)
      }
      // For other routes: token is truly invalid
      const token = localStorage.getItem('token')
      if (token) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
