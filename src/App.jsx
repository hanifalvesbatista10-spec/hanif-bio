import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AccountShortcut from "./components/layout/AccountShortcut";
import LegacySite from "./pages/LegacySite";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import RecoverPasswordPage from "./pages/auth/RecoverPasswordPage";
import UpdatePasswordPage from "./pages/auth/UpdatePasswordPage";
import BlockedPage from "./pages/auth/BlockedPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import "./styles/auth-admin.css";

function PublicHome(){return <><LegacySite/><AccountShortcut/></>}

export default function App(){
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<PublicHome/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/cadastro" element={<RegisterPage/>}/>
    <Route path="/recuperar-senha" element={<RecoverPasswordPage/>}/>
    <Route path="/atualizar-senha" element={<UpdatePasswordPage/>}/>
    <Route path="/conta-bloqueada" element={<BlockedPage/>}/>
    <Route path="/minha-area" element={<ProtectedRoute><StudentDashboard/></ProtectedRoute>}/>
    <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard/></ProtectedRoute>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></AuthProvider></BrowserRouter>
}
