import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ConversionHomePage from "./pages/public/ConversionHomePage";
import SobrePage from "./pages/public/SobrePage";
import ContentListPage from "./pages/public/ContentListPage";
import ContentDetailPage from "./pages/public/ContentDetailPage";
import PublicProductPage from "./pages/public/PublicProductPage";
import MentorshipPage from "./pages/public/MentorshipPage";
import ThankYouPage from "./pages/public/ThankYouPage";
import EventPage from "./pages/public/EventPage";
import PublicFormPage from "./pages/public/PublicFormPage";
import LoginPage from "./pages/auth/LoginPage";
import StudentLoginPage from "./pages/auth/StudentLoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import BlockedPage from "./pages/auth/BlockedPage";
import StudentCoursesPage from "./pages/student/StudentCoursesPage";
import CourseLessonsPage from "./pages/student/CourseLessonsPage";
import "./styles/auth-admin.css";

const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const FeedbacksPage = lazy(() => import("./pages/admin/FeedbacksPage"));
const FeedbackEditorPage = lazy(() => import("./pages/admin/FeedbackEditorPage"));
const ProductsPage = lazy(() => import("./pages/admin/ProductsPage"));
const ProductEditorPageV4 = lazy(() => import("./pages/admin/ProductEditorPageV4"));
const SiteSettingsPage = lazy(() => import("./pages/admin/SiteSettingsPage"));
const EventsPage = lazy(() => import("./pages/admin/EventsPage"));
const EventDetailPage = lazy(() => import("./pages/admin/EventDetailPage"));
const FormsPage = lazy(() => import("./pages/admin/FormsPage"));
const FormBuilderPage = lazy(() => import("./pages/admin/FormBuilderPage"));
const FormResultsPage = lazy(() => import("./pages/admin/FormResultsPage"));
const FaqPage = lazy(() => import("./pages/admin/FaqPage"));
const ContentPage = lazy(() => import("./pages/admin/ContentPage"));
const ContentEditorPage = lazy(() => import("./pages/admin/ContentEditorPage"));
const LessonsPage = lazy(() => import("./pages/admin/LessonsPage"));
const AccessPage = lazy(() => import("./pages/admin/AccessPage"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const MemberPreviewPage = lazy(() => import("./pages/admin/MemberPreviewPage"));
const LessonAuditPage = lazy(() => import("./pages/admin/LessonAuditPage"));
const CommentsPage = lazy(() => import("./pages/admin/CommentsPage"));

// Links antigos do Aulão Barro–CE continuam valendo (preservando ?origem=).
function LegacyEventRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/evento/aulao-aph-barro-2026${search}`} replace />;
}

function AdminFallback() {
  return <div className="auth-loading">Carregando painel administrativo...</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<ConversionHomePage />} />
          <Route path="/sobre" element={<SobrePage />} />
          <Route path="/conteudos" element={<ContentListPage />} />
          <Route path="/conteudos/:slug" element={<ContentDetailPage />} />
          <Route path="/evento/aulao-barro" element={<LegacyEventRedirect />} />
          <Route path="/produto/evento-aulao-barro" element={<LegacyEventRedirect />} />
          <Route path="/evento/:slug" element={<EventPage />} />
          <Route path="/produto/mentoria-aph" element={<MentorshipPage />} />
          <Route path="/produto/:slug" element={<PublicProductPage />} />
          <Route path="/obrigado/mentoria-aph" element={<ThankYouPage />} />
          <Route path="/f/:slug" element={<PublicFormPage />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Suspense fallback={<AdminFallback />}>
                  <AdminLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="site"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <SiteSettingsPage />
                </Suspense>
              }
            />
            <Route
              path="feedbacks"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FeedbacksPage />
                </Suspense>
              }
            />
            <Route
              path="feedbacks/novo"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FeedbackEditorPage />
                </Suspense>
              }
            />
            <Route
              path="feedbacks/:id"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FeedbackEditorPage />
                </Suspense>
              }
            />
            <Route
              path="produtos"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ProductsPage />
                </Suspense>
              }
            />
            <Route
              path="produtos/novo"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ProductEditorPageV4 />
                </Suspense>
              }
            />
            <Route
              path="produtos/:id"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ProductEditorPageV4 />
                </Suspense>
              }
            />
            <Route path="inscricoes" element={<Navigate to="/admin/eventos" replace />} />
            <Route
              path="eventos"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <EventsPage />
                </Suspense>
              }
            />
            <Route
              path="eventos/novo"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <EventDetailPage />
                </Suspense>
              }
            />
            <Route
              path="eventos/:id"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <EventDetailPage />
                </Suspense>
              }
            />
            <Route
              path="formularios"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FormsPage />
                </Suspense>
              }
            />
            <Route
              path="formularios/novo"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FormBuilderPage />
                </Suspense>
              }
            />
            <Route
              path="formularios/:id"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FormBuilderPage />
                </Suspense>
              }
            />
            <Route
              path="formularios/:id/resultados"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FormResultsPage />
                </Suspense>
              }
            />
            <Route
              path="faq"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <FaqPage />
                </Suspense>
              }
            />
            <Route
              path="conteudos"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ContentPage />
                </Suspense>
              }
            />
            <Route
              path="conteudos/novo"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ContentEditorPage />
                </Suspense>
              }
            />
            <Route
              path="conteudos/:id"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ContentEditorPage />
                </Suspense>
              }
            />
            <Route
              path="aulas"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <LessonsPage />
                </Suspense>
              }
            />
            <Route
              path="acessos"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AccessPage />
                </Suspense>
              }
            />
            <Route
              path="usuarios"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <UsersPage />
                </Suspense>
              }
            />
            <Route
              path="area-de-membros"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <MemberPreviewPage />
                </Suspense>
              }
            />
            <Route
              path="auditoria"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <LessonAuditPage />
                </Suspense>
              }
            />
            <Route
              path="comentarios"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <CommentsPage />
                </Suspense>
              }
            />
          </Route>

          <Route path="/login" element={<StudentLoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/bloqueado" element={<BlockedPage />} />
          <Route path="/recuperar-senha" element={<Navigate to="/login" replace />} />
          <Route
            path="/minha-area"
            element={
              <ProtectedRoute redirectTo="/login">
                <StudentCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/minha-area/curso/:productId"
            element={
              <ProtectedRoute redirectTo="/login">
                <CourseLessonsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
