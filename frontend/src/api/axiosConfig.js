import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  timeout: 10000,
  headers: {
    'Accept': 'application/json'
  }
});

// Optional logging interceptor for easier debugging during development
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

/**
 * Phase 1 Document REST API helpers
 */
export const documentApi = {
  // GET /api/documents - Fetch list of all documents
  getAll: () => api.get('/documents'),

  // GET /api/documents/{id} - Fetch single document by UUID
  getById: (id) => api.get(`/documents/${id}`),

  // POST /api/documents?title={title}&ownerId={ownerId}
  create: (title, ownerId) =>
    api.post('/documents', null, {
      params: { title, ownerId }
    }),

  // PUT /api/documents/{id} with plain text body
  update: (id, content) =>
    api.put(`/documents/${id}`, content ?? '', {
      headers: { 'Content-Type': 'text/plain' }
    }),

  // DELETE /api/documents/{id}
  delete: (id) => api.delete(`/documents/${id}`)
};

export default api;
