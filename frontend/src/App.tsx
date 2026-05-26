import { Routes, Route } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import Tutorat from './pages/Tutorat'
import Login from './pages/Login'
import Boiteaidee from './pages/Boiteaidee'
import { ProtectedRoute } from './components/ProtectedRoute'
import SetPassword from './pages/SetPassword'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/agenda"
          element={
            <ProtectedRoute>
              <Agenda />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tutorat"
          element={
            <ProtectedRoute>
              <Tutorat />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route
          path="/boiteaidee"
          element={
            <ProtectedRoute>
              <Boiteaidee />
            </ProtectedRoute>
          }
        />
        <Route
          path="/set-password"
          element={
            <ProtectedRoute>
              <SetPassword />
            </ProtectedRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
    </Routes>
  )
}
