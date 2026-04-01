import axios from 'axios';

const runtimeApiBase =
    typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:8000/api/`
        : 'http://127.0.0.1:8000/api/';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || runtimeApiBase,
});

// Automatically add Bearer token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('access');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-refresh token on 401 errors
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const requestUrl = String(error.config?.url || '');
        const isLoginRequest = requestUrl.includes('auth/login/');
        
        // Don't intercept blob responses (file downloads)
        if (error.config?.responseType === 'blob') {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !isLoginRequest) {
            localStorage.removeItem('access');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
