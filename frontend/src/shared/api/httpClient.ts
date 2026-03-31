import axios from 'axios'

function normalizeBaseUrl(raw: string) {
  return raw.replace(/\/+$/, '')
}

const baseURL = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? 'http://localhost:8000')

export const http = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

