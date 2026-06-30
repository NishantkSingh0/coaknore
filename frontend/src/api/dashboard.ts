import api from './client'

export const getAdminDashboard = () =>
  api.get('/dashboard/admin').then(r => r.data.data)

export const getLayer2Dashboard = () =>
  api.get('/dashboard/layer2').then(r => r.data.data)

export const getLayer3Dashboard = () =>
  api.get('/dashboard/layer3').then(r => r.data.data)
