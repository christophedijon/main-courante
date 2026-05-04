import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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

import { SaisieProvider } from './mobile/saisie/SaisieContext';
import MobileLayout from './mobile/MobileLayout';
import HomePage from './mobile/pages/HomePage';
import ToolboxPage from './mobile/pages/ToolboxPage';
import HistoryPage from './mobile/pages/HistoryPage';
import SearchPage from './mobile/pages/SearchPage';
import MobileProfilePage from './mobile/pages/MobileProfilePage';
import MobileAdminPage from './mobile/pages/MobileAdminPage';
import PostesMobilePage from './mobile/pages/PostesMobilePage';
import AssignationPage from './mobile/pages/AssignationPage';
import EventDetailPage from './mobile/pages/EventDetailPage';
import DocumentListPage from './mobile/pages/DocumentListPage';
import DocumentDetailPage from './mobile/pages/DocumentDetailPage';
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

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <svg className="animate-spin w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
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
  const { session, loading, hasAdminAccess } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/" replace />;
  if (!hasAdminAccess) return <Navigate to="/mobile" replace />;
  return <>{children}</>;
}

function MobileRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SaisieProvider>
          <Routes>
            <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />

            {/* Desktop back-office (inchangé) */}
            <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
            <Route path="/dashboard/users/:id" element={<AdminRoute><UserEditPage /></AdminRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/entreprise" element={<AdminRoute><EntreprisePage /></AdminRoute>} />
            <Route path="/espaces-zones" element={<AdminRoute><EspacesZonesPage /></AdminRoute>} />
            <Route path="/ia" element={<AdminRoute><IAPage /></AdminRoute>} />
            <Route path="/motifs" element={<AdminRoute><MotifsPage /></AdminRoute>} />
            <Route path="/documents" element={<AdminRoute><DocumentsPage /></AdminRoute>} />
            <Route path="/postes" element={<AdminRoute><PostesPage /></AdminRoute>} />

            {/* Mobile app */}
            <Route path="/mobile" element={<MobileRoute><MobileLayout /></MobileRoute>}>
              <Route index element={<HomePage />} />
              <Route path="outils" element={<ToolboxPage />} />
              <Route path="historique" element={<HistoryPage />} />
              <Route path="recherche" element={<SearchPage />} />
              <Route path="profil" element={<MobileProfilePage />} />
              <Route path="admin" element={<MobileAdminPage />} />
              <Route path="postes" element={<PostesMobilePage />} />
              <Route path="assignation" element={<AssignationPage />} />
              <Route path="evenement/:id" element={<EventDetailPage />} />
              <Route path="outils/documents/:categorie" element={<DocumentListPage />} />
              <Route path="outils/documents/:categorie/:id" element={<DocumentDetailPage />} />
              {/* SSI flow (unchanged) */}
              <Route path="saisie/:type/etablissement" element={<StepEtablissement />} />
              <Route path="saisie/:type/espace" element={<StepEspace />} />
              <Route path="saisie/:type/zone" element={<StepZone />} />
              <Route path="saisie/:type/niveau" element={<StepNiveau />} />
              <Route path="saisie/:type/motifs" element={<StepMotifs />} />
              <Route path="saisie/:type/commentaire" element={<StepCommentaire />} />
              {/* SSI 3-step flow */}
              <Route path="saisie/ssi/ssi-zone" element={<StepSsiZone />} />
              <Route path="saisie/ssi/ssi-motifs" element={<StepSsiMotifs />} />
              {/* Gestion client (securite_personnes) 2-screen flow */}
              <Route path="saisie/:type/localisation" element={<StepLocalisation />} />
              <Route path="saisie/:type/description" element={<StepDescription />} />
              <Route path="saisie/:type/recap" element={<StepRecap />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SaisieProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
