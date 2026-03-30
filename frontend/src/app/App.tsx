import { Route, Routes } from 'react-router-dom'
import MainPage from '../pages/MainPage/MainPage'
import { ToastProvider } from '../shared/ui/Toast/ToastProvider'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="*" element={<MainPage />} />
      </Routes>
    </ToastProvider>
  )
}

