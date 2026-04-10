import axios from 'axios'
import Cookies from 'js-cookie'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Token qo'shish
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status   = error.response?.status

    // Bu xatolarda LOGOUT QILINMAYDI
    if (!status || [429, 500, 502, 503, 504].includes(status)) {
      return Promise.reject(error)
    }

    // 401 — token muddati tugagan, refresh qilamiz
    // Login sahifasida bo'lsak redirect qilmaymiz
    if (status === 401 && !original._retry) {
      original._retry = true

      // Login/refresh endpointlarida loopdan saqlaymiz
      if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      const refreshToken = Cookies.get('refreshToken')

      if (!refreshToken) {
        Cookies.remove('accessToken')
        if (window.location.pathname !== '/login') window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 10000 }
        )
        const newToken = data.data.accessToken
        Cookies.set('accessToken', newToken, { expires: 7 })
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        Cookies.remove('accessToken')
        Cookies.remove('refreshToken')
        if (window.location.pathname !== '/login') window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
