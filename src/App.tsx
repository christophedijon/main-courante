import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { Shield } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import UserEditPage from './pages/UserEditPage';
import EntreprisePage from './pages/EntreprisePage';
import EspacesZonesPage from './pages/EspacesZonesPage';
import IAPage from './pages/IAPage';
import MotifsPage from './pages/MotifsPage';
import DocumentsPage from './pages/DocumentsPage';
import PostesPage from './pages/PostesPage';
import DashboardSignaturesPage from './pages/DashboardSignaturesPage';
import RapportsPage from './pages/RapportsPage';
import RegistreSecuritePage from './pages/RegistreSecuritePage';
import EmailsPage from './pages/EmailsPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import BaliseRondesPage from './pages/BaliseRondesPage';
import JaugeConfigPage from './pages/JaugeConfigPage';
import JaugePage from './pages/JaugePage';
import ConfirmRegistrePage from './pages/ConfirmRegistrePage';
import BackupPage from './pages/BackupPage';
import OnboardingPage from './pages/OnboardingPage';
import ClientsPage from './pages/ClientsPage';
import EditorAccessPage from './pages/EditorAccessPage';
import EditorBackofficePage from './pages/EditorBackofficePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { SaisieProvider } from './mobile/saisie/SaisieContext';
import MobileLayout from './mobile/MobileLayout';
import HomePage from './mobile/pages/HomePage';
import ToolboxPage from './mobile/pages/ToolboxPage';
import HistoryPage from './mobile/pages/HistoryPage';
import SearchPage from './mobile/pages/SearchPage';
import MobileProfilePage from './mobile/pages/MobileProfilePage';
import MobileAdminPage from './mobile/pages/MobileAdminPage';
import AssignationPage from './mobile/pages/AssignationPage';
import PostesMobilePage from './mobile/pages/PostesMobilePage';
import EventDetailPage from './mobile/pages/EventDetailPage';
import DocumentListPage from './mobile/pages/DocumentListPage';
import DocumentDetailPage from './mobile/pages/DocumentDetailPage';
import AssistantIAPage from './mobile/pages/AssistantIAPage';
import RegistreMobilePage from './mobile/pages/RegistreMobilePage';
import StepEtablissement from './mobile/saisie/StepEtablissement';
import StepEspace from './mobile/saisie/StepEspace';
import StepZone from './mobile/saisie/StepZone';
import StepNiveau from './mobile/saisie/StepNiveau';
import StepMotifs from './mobile/saisie/StepMotifs';
import StepCommentaire from './mobile/saisie/StepCommentaire';
import StepRecap from './mobile/saisie/StepRecap';
import StepLocalisation from './mobile/saisie/StepLocalisation';
import StepDescription from './mobile/saisie/StepDescription';
import StepSsiZone from './mobile/saisie/StepSsiZone';
import StepSsiMotifs from './mobile/saisie/StepSsiMotifs';
import { RoleRoute } from './mobile/components/RoleRoute';

function EditorAccessBanner() {
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('editor-sessions-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'editor_sessions' },
        (payload) => {
          const newRow = payload.new as { connected_at: string | null; is_active: boolean };
          const oldRow = payload.old as { connected_at: string | null };
          if (newRow.is_active && newRow.connected_at && !oldRow.connected_at) {
            setVisible(true);
            setTimeout(() => setVisible(false), 8000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-6 py-4 text-white font-semibold text-sm shadow-2xl"
      style={{ backgroundColor: '#f59e0b' }}
    >
      <Shield className="w-5 h-5 shrink-0" />
      L'éditeur SARL Gréco vient d'accéder à votre application
    </div>
  );
}

const EDITOR_REDIRECTABLE_PATHS = [
  '/dashboard', '/profile', '/entreprise', '/espaces-zones',
  '/ia', '/motifs', '/documents', '/postes', '/dashboard-signatures',
  '/rapports', '/registre-securite', '/emails', '/balises-rondes', '/jauge',
  '/jauge/config',
];

function EditorSessionGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('editor_session');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed.editorMode) return;
    } catch {
      return;
    }
    const match = EDITOR_REDIRECTABLE_PATHS.find(
      (p) => location.pathname === p || location.pathname.startsWith(p + '/')
    );
    if (match) {
      navigate(`/editor/backoffice${location.pathname}`, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

function OfflineSignatureSync() {
  useEffect(() => {
    async function syncPending() {
      const pending = JSON.parse(localStorage.getItem('mc_pending_signatures') ?? '[]');
      if (pending.length === 0) return;
      for (const sig of pending) {
        await supabase.from('signatures').upsert({ ...sig, synced: true });
      }
      localStorage.removeItem('mc_pending_signatures');
    }
    window.addEventListener('online', syncPending);
    return () => window.removeEventListener('online', syncPending);
  }, []);
  return null;
}

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <svg className="animate-spin w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (session) return <Navigate to="/mobile" replace />;
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userMetaReady, hasAdminAccess } = useAuth();
  if (loading || !userMetaReady) return <Spinner />;
  if (!session) return <Navigate to="/" replace />;
  if (!hasAdminAccess) return <Navigate to="/mobile" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userMetaReady, isSuperAdmin } = useAuth();
  if (loading || !userMetaReady) return <Spinner />;
  if (!session) return <Navigate to="/" replace />;
  if (!isSuperAdmin) return <Navigate to="/mobile" replace />;
  return <>{children}</>;
}

function MobileRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userMetaReady, mustCompleteProfile } = useAuth();
  if (loading || !userMetaReady) return <Spinner />;
  if (!session) return <Navigate to="/" replace />;
  if (mustCompleteProfile) return <Navigate to="/complete-profile" replace />;
  return <>{children}</>;
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SaisieProvider>
          <EditorAccessBanner />
          <EditorSessionGuard />
          <OfflineSignatureSync />
          <Routes>
            <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/complete-profile" element={<PrivateRoute><CompleteProfilePage /></PrivateRoute>} />
            <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
            <Route path="/dashboard/users/:id" element={<AdminRoute><UserEditPage /></AdminRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/entreprise" element={<AdminRoute><EntreprisePage /></AdminRoute>} />
            <Route path="/espaces-zones" element={<AdminRoute><EspacesZonesPage /></AdminRoute>} />
            <Route path="/ia" element={<AdminRoute><IAPage /></AdminRoute>} />
            <Route path="/motifs" element={<AdminRoute><MotifsPage /></AdminRoute>} />
            <Route path="/documents" element={<AdminRoute><DocumentsPage /></AdminRoute>} />
            <Route path="/postes" element={<AdminRoute><PostesPage /></AdminRoute>} />
            <Route path="/dashboard-signatures" element={<AdminRoute><DashboardSignaturesPage /></AdminRoute>} />
            <Route path="/rapports" element={<AdminRoute><RapportsPage /></AdminRoute>} />
            <Route path="/registre-securite" element={<AdminRoute><RegistreSecuritePage /></AdminRoute>} />
            <Route path="/emails" element={<SuperAdminRoute><EmailsPage /></SuperAdminRoute>} />
            <Route path="/balises-rondes" element={<AdminRoute><BaliseRondesPage /></AdminRoute>} />
            <Route path="/jauge" element={<AdminRoute><JaugePage /></AdminRoute>} />
            <Route path="/jauge/config" element={<AdminRoute><JaugeConfigPage /></AdminRoute>} />
            <Route path="/mobile" element={<MobileRoute><MobileLayout /></MobileRoute>}>
              {/* ALL roles */}
              <Route index element={<HomePage />} />
              <Route path="outils" element={<ToolboxPage />} />
              <Route path="historique" element={<HistoryPage />} />
              <Route path="recherche" element={<SearchPage />} />
              <Route path="profil" element={<MobileProfilePage />} />
              <Route path="postes" element={<PostesMobilePage />} />
              <Route path="evenement/:id" element={<EventDetailPage />} />
              {/* ALL roles — content filtered inside the page for Serveur */}
              {/* TODO: filter documents by role inside DocumentsPage */}
              <Route path="outils/documents/:categorie" element={<DocumentListPage />} />
              <Route path="outils/documents/:categorie/:id" element={<DocumentDetailPage />} />

              {/* SuperAdmin, Direction, Chef de poste */}
              <Route path="admin" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste']}>
                  <MobileAdminPage />
                </RoleRoute>
              } />
              <Route path="assignation" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste']}>
                  <AssignationPage />
                </RoleRoute>
              } />

              {/* SuperAdmin, Direction, Chef de poste, Agent de Sécurité */}
              <Route path="assistant-ia" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <AssistantIAPage />
                </RoleRoute>
              } />
              <Route path="registre-securite" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <RegistreMobilePage />
                </RoleRoute>
              } />
              <Route path="saisie/:type/etablissement" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepEtablissement />
                </RoleRoute>
              } />
              <Route path="saisie/:type/espace" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepEspace />
                </RoleRoute>
              } />
              <Route path="saisie/:type/zone" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepZone />
                </RoleRoute>
              } />
              <Route path="saisie/:type/niveau" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepNiveau />
                </RoleRoute>
              } />
              <Route path="saisie/:type/motifs" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepMotifs />
                </RoleRoute>
              } />
              <Route path="saisie/:type/commentaire" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepCommentaire />
                </RoleRoute>
              } />
              <Route path="saisie/ssi/ssi-zone" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepSsiZone />
                </RoleRoute>
              } />
              <Route path="saisie/ssi/ssi-motifs" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepSsiMotifs />
                </RoleRoute>
              } />
              <Route path="saisie/:type/localisation" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepLocalisation />
                </RoleRoute>
              } />
              <Route path="saisie/:type/description" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepDescription />
                </RoleRoute>
              } />
              <Route path="saisie/:type/recap" element={
                <RoleRoute allowedRoles={['SuperAdmin', 'Direction', 'Chef de poste', 'Agent de Sécurité']}>
                  <StepRecap />
                </RoleRoute>
              } />
            </Route>
            <Route path="/confirm-registre" element={<ConfirmRegistrePage />} />
            <Route path="/editor" element={<EditorAccessPage />} />
            <Route path="/editor/backoffice" element={<EditorBackofficePage />}>
              <Route index element={<Navigate to="entreprise" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="dashboard/users/:id" element={<UserEditPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="entreprise" element={<EntreprisePage />} />
              <Route path="espaces-zones" element={<EspacesZonesPage />} />
              <Route path="ia" element={<IAPage />} />
              <Route path="motifs" element={<MotifsPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="postes" element={<PostesPage />} />
              <Route path="dashboard-signatures" element={<DashboardSignaturesPage />} />
              <Route path="rapports" element={<RapportsPage />} />
              <Route path="registre-securite" element={<RegistreSecuritePage />} />
              <Route path="emails" element={<EmailsPage />} />
              <Route path="balises-rondes" element={<BaliseRondesPage />} />
              <Route path="jauge" element={<JaugeConfigPage />} />
            </Route>
            <Route path="/backup" element={<SuperAdminRoute><BackupPage /></SuperAdminRoute>} />
            <Route path="/onboarding" element={<SuperAdminRoute><OnboardingPage /></SuperAdminRoute>} />
            <Route path="/clients" element={<SuperAdminRoute><ClientsPage /></SuperAdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SaisieProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
