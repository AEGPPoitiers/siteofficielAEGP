import { Routes, Route } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import EventDetail from './pages/EventDetail'
import EventNew from './pages/EventNew'
import EventEdit from './pages/EventEdit'
import Tutorat from './pages/Tutorat'
import Login from './pages/Login'
import Boiteaidee from './pages/Boiteaidee'
import AdminUsers from './pages/AdminUsers'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BdeProtectedRoute } from './components/BdeProtectedRoute'
import { AdminProtectedRoute } from './components/AdminProtectedRoute'
import SetPassword from './pages/SetPassword'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route
          path="/agenda/new"
          element={
            <BdeProtectedRoute>
              <EventNew />
            </BdeProtectedRoute>
          }
        />
        <Route path="/agenda/:id" element={<EventDetail />} />
        <Route
          path="/agenda/:id/edit"
          element={
            <BdeProtectedRoute>
              <EventEdit />
            </BdeProtectedRoute>
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
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminUsers />
            </AdminProtectedRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
    </Routes>
  )
}
