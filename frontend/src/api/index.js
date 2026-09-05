import request from './request'

export const authApi = {
  login: (data) => request.post('/auth/login', data),
  me: () => request.get('/auth/me')
}

export const userApi = {
  list: () => request.get('/users'),
  create: (data) => request.post('/users', data),
  update: (id, data) => request.put(`/users/${id}`, data),
  remove: (id) => request.delete(`/users/${id}`)
}

export const departmentApi = {
  list: () => request.get('/departments')
}

export const patientApi = {
  list: (params) => request.get('/patients', { params }),
  create: (data) => request.post('/patients', data),
  update: (id, data) => request.put(`/patients/${id}`, data),
  remove: (id) => request.delete(`/patients/${id}`)
}

export const drugApi = {
  list: (params) => request.get('/drugs', { params })
}

export const orderApi = {
  create: (data) => request.post('/orders', data),
  update: (id, data) => request.put(`/orders/${id}`, data),
  detail: (id) => request.get(`/orders/${id}`),
  list: (params) => request.get('/orders', { params }),
  submit: (id) => request.post(`/orders/${id}/submit`),
  reject: (id) => request.post(`/orders/${id}/reject`),
  precheck: (data) => request.post('/orders/precheck', data)
}

export const ruleApi = {
  list: () => request.get('/rules'),
  create: (data) => request.post('/rules', data),
  update: (id, data) => request.put(`/rules/${id}`, data),
  toggle: (id) => request.put(`/rules/${id}/toggle`),
  remove: (id) => request.delete(`/rules/${id}`)
}

export const libraryApi = {
  list: (params) => request.get('/rules-library', { params }),
  categories: () => request.get('/rules-library/categories'),
  detail: (seq) => request.get(`/rules-library/${seq}`)
}

export const auditApi = {
  list: (params) => request.get('/audits', { params }),
  detail: (id) => request.get(`/audits/${id}`),
  feedback: (id, data) => request.post(`/audits/${id}/feedback`, data),
  review: (id, data) => request.post(`/audits/${id}/review`, data),
  logs: (orderId) => request.get(`/audits/${orderId}/logs`),
  allLogs: (params) => request.get('/audits/logs', { params }),
  exportExcel: (params) => request.get('/audits/export', { params, responseType: 'blob' })
}

export const statsApi = {
  violations: () => request.get('/stats/violations'),
  ruleDistribution: () => request.get('/stats/rule-distribution'),
  ruleQuality: () => request.get('/stats/rule-quality')
}

export const knowledgeApi = {
  list: (params) => request.get('/knowledge', { params }),
  detail: (id) => request.get(`/knowledge/${id}`),
  create: (data) => request.post('/knowledge', data),
  update: (id, data) => request.put(`/knowledge/${id}`, data),
  remove: (id) => request.delete(`/knowledge/${id}`),
  importExcel: (data) => request.post('/knowledge/import', data)
}
