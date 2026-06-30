import axios from 'axios'
import { normalizeGoResponse } from '../utils/normalizeGoResponse'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT from localStorage on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('pms_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Normalize Go null slices → [] on every response
api.interceptors.response.use(
  res => {
    res.data = normalizeGoResponse(res.data)
    return res
  },
  err => {
    if (err.response?.data) {
      err.response.data = normalizeGoResponse(err.response.data)
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('pms_token')
      localStorage.removeItem('pms_user')
      window.location.href = '/login'
    }

    return Promise.reject(err)
  },
)

export default api
