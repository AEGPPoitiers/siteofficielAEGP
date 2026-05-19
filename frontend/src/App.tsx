import { Routes, Route } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import Tutorat from './pages/Tutorat'
import Login from './pages/Login'
import Boiteaidee from './pages/Boiteaidee'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/tutorat" element={<Tutorat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/boiteaidee" element={<Boiteaidee />} />
      </Route>
    </Routes>
  )
}
