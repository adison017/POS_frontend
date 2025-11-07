import axios from 'axios'

const baseURL = (() => {
  const raw = import.meta.env.VITE_BACKEND_URL?.trim()
  if (raw) {
    const hasProtocol = /^https?:\/\//i.test(raw)
    const normalized = hasProtocol ? raw : `http://${raw}`
    return `${normalized.replace(/\/$/, '')}/api`
  }
  // No env: rely on Vite proxy (vite.config.js) via relative path
  return '/api'
})()

const apiClient = axios.create({
  baseURL,
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message
    return Promise.reject({
      ...error,
      message,
      status: error.response?.status,
      details: error.response?.data?.details,
    })
  },
)

export default apiClient

