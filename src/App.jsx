import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import Home from "@/pages/Home"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import ResetPassword from "@/pages/ResetPassword"
import AuthConfirmation from "@/pages/AuthConfirmation"
import Profile from "@/pages/Profile"
import CookiePreferences from "@/components/CookiePreferences"
import { isLocalPreview } from "@/lib/environment"

function LoadingHome() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-sm text-[#73766e]">
      Loading your asterisco space...
    </main>
  )
}

function RootRoute() {
  const { loading } = useAuth()
  if (loading) return <LoadingHome />
  return <Navigate to="/home" replace />
}

function ProtectedHome() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingHome />
  return user ? <Home /> : <Home preview />
}

function ProtectedProfile() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingHome />
  return user || isLocalPreview ? <Profile /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/home" element={<ProtectedHome />} />
        <Route path="/profile" element={<ProtectedProfile />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/confirmed" element={<AuthConfirmation />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <CookiePreferences />
    </>
  )
}