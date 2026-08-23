import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import ConversionHomePage from "./pages/public/ConversionHomePage";
import PublicProductPage from "./pages/public/PublicProductPage";
import LoginPage from "./pages/auth/LoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import FeedbacksPage from "./pages/admin/FeedbacksPage";
import FeedbackEditorPage from "./pages/admin/FeedbackEditorPage";
import ProductsPage from "./pages/admin/ProductsPage";
import ProductEditorPage from "./pages/admin/ProductEditorPage";
import SiteSettingsPage from "./pages/admin/SiteSettingsPage";
import "./styles/auth-admin.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<ConversionHomePage />} />
          <Route path="/produto/:slug" element={<PublicProductPage />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="site" element={<SiteSettingsPage />} />
            <Route path="feedbacks" element={<FeedbacksPage />} />
            <Route path="feedbacks/novo" element={<FeedbackEditorPage />} />
            <Route path="feedbacks/:id" element={<FeedbackEditorPage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route path="produtos/novo" element={<ProductEditorPage />} />
            <Route path="produtos/:id" element={<ProductEditorPage />} />
          </Route>

          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/cadastro" element={<Navigate to="/" replace />} />
          <Route path="/recuperar-senha" element={<Navigate to="/admin/login" replace />} />
          <Route path="/minha-area" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
