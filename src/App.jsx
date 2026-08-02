import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AccountShortcut from "./components/layout/AccountShortcut";
import AdminLayout from "./components/admin/AdminLayout";
import LegacySite from "./pages/LegacySite";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import RecoverPasswordPage from "./pages/auth/RecoverPasswordPage";
import UpdatePasswordPage from "./pages/auth/UpdatePasswordPage";
import BlockedPage from "./pages/auth/BlockedPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsersPage from "./pages/admin/UsersPage";
import FeedbacksPage from "./pages/admin/FeedbacksPage";
import FeedbackEditorPage from "./pages/admin/FeedbackEditorPage";
import AnalysesPage from "./pages/admin/AnalysesPage";
import AnalysisEditorPage from "./pages/admin/AnalysisEditorPage";
import ProductsPage from "./pages/admin/ProductsPage";
import ProductEditorPage from "./pages/admin/ProductEditorPage";
import PublicProductPage from "./pages/public/PublicProductPage";
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
    <Route path="/produto/:slug" element={<PublicProductPage/>}/>
    <Route path="/minha-area" element={<ProtectedRoute><StudentDashboard/></ProtectedRoute>}/>
    <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout/></ProtectedRoute>}>
      <Route index element={<AdminDashboard/>}/>
      <Route path="usuarios" element={<UsersPage/>}/>
      <Route path="feedbacks" element={<FeedbacksPage/>}/>
      <Route path="feedbacks/novo" element={<FeedbackEditorPage/>}/>
      <Route path="feedbacks/:id" element={<FeedbackEditorPage/>}/>
      <Route path="analises" element={<AnalysesPage/>}/>
      <Route path="analises/nova" element={<AnalysisEditorPage/>}/>
      <Route path="analises/:id" element={<AnalysisEditorPage/>}/>
      <Route path="produtos" element={<ProductsPage/>}/>
      <Route path="produtos/novo" element={<ProductEditorPage/>}/>
      <Route path="produtos/:id" element={<ProductEditorPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></AuthProvider></BrowserRouter>
}
