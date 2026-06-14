import axios from "axios"

// same-origin, under the /spotter/ base -> "/spotter/api"
const api = axios.create({ baseURL: import.meta.env.BASE_URL + "api" })

// attach JWT access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// on 401, clear creds and bounce to login (unless already there)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access")
      localStorage.removeItem("refresh")
      const loginPath = import.meta.env.BASE_URL + "login"
      if (!window.location.pathname.endsWith("/login")) {
        window.location.assign(loginPath)
      }
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  register: (email, password) => api.post("/auth/register", { email, password }),
  login: (email, password) => api.post("/token/pair", { username: email, password }),
  me: () => api.get("/auth/me"),
}

export const tripApi = {
  plan: (payload) => api.post("/trip", payload),
  list: () => api.get("/trips"),
  get: (id) => api.get(`/trips/${id}`),
  update: (id, logs) => api.patch(`/trips/${id}`, { logs }),
  // keep the first keepThrough days; re-simulate the remaining trip after them
  cascade: (id, logs, keepThrough) => api.post(`/trips/${id}/cascade`, { logs, keep_through: keepThrough }),
  remove: (id) => api.delete(`/trips/${id}`),
}
