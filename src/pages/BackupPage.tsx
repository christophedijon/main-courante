import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Database, Code, CheckCircle, Loader } from 'lucide-react';

export default function BackupPage() {
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlDone, setSqlDone] = useState(false);

  async function downloadSQL() {
    setSqlLoading(true);
    setSqlDone(false);
    try {
      const tables: Record<string, string> = {
        espaces: 'id, nom, description, couleur, created_at, updated_at',
        zones_ssi: 'id, nom, description, actif, ordre, created_at, updated_at',
        zones: 'id, espace_id, nom, description, capacite, created_at, updated_at, categorie',
        super_admins: 'id, email, created_at',
        managed_users: 'id, email, fonction, status, created_at, auth_user_id, is_super_admin, is_provisoire, provisoire_expires_at, profile_completed, invited_by, invited_at',
        user_profiles: 'id, first_name, last_name, updated_at, telephone, nationalite, carte_sejour_numero, carte_sejour_validite, carte_pro_numero, carte_pro_validite',
        entreprise: 'id, nom, adresse, telephone, logo_url, updated_at, type_erp, categorie_erp, effectif_public, effectif_personnel, activite_principale, activites_complementaires, licence_boissons, questionnaire_reponses, derniere_visite_commission, siret, code_ape, horaires_ouverture, activites_reelles, ronde_mode, mode_jauge, effectif_public_maximum, enseigne, email',
        motifs: 'id, nom, description, ordre, created_at',
        motifs_ssi: 'id, nom, description, ordre, created_at',
        niveaux_intervention: 'id, label, description, ordre, created_at',
        postes: 'id, nom, fonction, description, actif, ordre, created_at, updated_at',
        assignations: 'id, poste_id, agent_id, agent_nom, agent_fonction, assigned_by, assigned_at, actif',
        beacons: 'id, zone_id, nom, description, minor, major, uuid_beacon, mac, rssi_seuil, is_entree, actif, created_at',
        rondes_config: 'id, nom, heure_prevue, mode, actif, created_at',
        rondes_config_balises: 'id, ronde_config_id, beacon_id, ordre',
        rondes_passages: 'id, agent_id, beacon_id, ronde_config_id, rssi, timestamp',
        rondes_rapports: 'id, agent_id, date_nuit, heure_prise_poste, created_at',
        evenements: 'id, numero, type, espace_id, zone_id, niveau_id, espace_nom, zone_nom, niveau_label, commentaire, date_evenement, created_at, created_by, created_by_email, user_fonction, etablissement_nom, zone_ssi_id',
        evenement_motifs: 'evenement_id, motif_id, motif_nom',
        evenement_medias: 'id, evenement_id, storage_path, mime_type, original_name, created_by, created_at',
        toolbox_documents: 'id, titre, description, contenu, categorie, ordre, actif, created_at, updated_at, destinataires, signature_requise, content_version',
        signatures: 'id, document_id, agent_id, agent_nom, agent_role, signed_at, content_version, synced, created_at',
        evacuation_plans: 'id, nom, file_url, file_path, created_at',
        company_documents: 'id, nom, file_url, file_path, created_at',
        ia_settings: 'id, prompt, gpt_model, updated_at, prompt_erp, gpt_model_erp, prompt_bruit, gpt_model_bruit, prompt_router, gpt_model_router',
        ia_historique: 'id, agent_id, agent_nom, question, reponse_complete, sections, created_at',
        rapports_soiree: 'id, date_soiree, debut_soiree, fin_soiree, nb_evenements, nb_agents, contenu_html, created_at',
        rapport_email_settings: 'id, email_destination, email_enabled, created_at, updated_at, heure_envoi',
        email_rules: 'id, type, label, active, dest_direction, dest_chef_de_poste, dest_agent_securite, dest_serveur, dest_email_organisme, dest_emails_libres, rappel_retard_frequence, created_at, updated_at',
        registre_securite: 'id, installation, reference_reglementaire, organisme_verificateur, periodicite, applicable, date_verification, nom_verificateur, observations, observations_levees, rapport_url, created_at, updated_at, email_organisme, jours_rappel, confirme_par_organisme, confirme_at, confirme_organisme_email',
        registre_historique: 'id, registre_id, date_verification, nom_verificateur, rapport_url, observations, observations_levees, created_at',
        jauge_etat: 'id, entreprise_id, count_actuel, date_soiree, updated_at, updated_by',
        jauge_actions: 'id, entreprise_id, action, delta, source, created_at, created_by',
        user_formations: 'id, user_id, type_formation, date_formation, created_at',
      };

      const now = new Date().toISOString().slice(0, 10);
      let sql = `-- =============================================================\n`;
      sql += `-- SAUVEGARDE BASE DE DONNÉES - ${now}\n`;
      sql += `-- Application: Melkior / Bal'tazar - Sécurité & Gestion\n`;
      sql += `-- =============================================================\n`;
      sql += `-- RESTAURATION: appliquer d'abord supabase/migrations/ puis ce fichier\n`;
      sql += `-- =============================================================\n\n`;
      sql += `SET session_replication_role = replica;\n\n`;

      for (const [table, cols] of Object.entries(tables)) {
        const { data, error } = await supabase.from(table).select(cols);
        if (error || !data || data.length === 0) {
          sql += `-- TABLE: ${table} (vide ou inaccessible)\n\n`;
          continue;
        }
        sql += `-- TABLE: ${table} (${data.length} lignes)\n`;
        const colList = cols.split(', ');
        for (const row of data) {
          const values = colList.map(col => {
            const v = (row as Record<string, unknown>)[col];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            if (typeof v === 'number') return String(v);
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          sql += `INSERT INTO public.${table} (${cols}) VALUES (${values.join(',')});\n`;
        }
        sql += '\n';
      }

      sql += `SET session_replication_role = DEFAULT;\n`;
      sql += `-- FIN DE SAUVEGARDE ${now}\n`;

      const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-db-${now}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      setSqlDone(true);
    } finally {
      setSqlLoading(false);
    }
  }

  function downloadMigrations() {
    const info = `Pour obtenir le code source complet :

1. Dans Bolt.new, cliquez sur le bouton "Export" ou l'icône de téléchargement
   en haut à droite de l'interface (icône avec une flèche vers le bas)

2. Ou utilisez le raccourci : dans le panneau de fichiers,
   cherchez un bouton "Download project" ou "Export ZIP"

Les fichiers de migration SQL se trouvent dans :
  supabase/migrations/  (67 fichiers)

Le code source se trouve dans :
  src/  (composants React)
  supabase/functions/  (8 Edge Functions)`;

    const blob = new Blob([info], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'instructions-code-source.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-white mb-2">Sauvegarde du projet</h1>
        <p className="text-slate-400 text-sm mb-8">
          Téléchargez les sauvegardes directement dans votre navigateur.
        </p>

        <div className="space-y-4">
          {/* SQL export */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">Export SQL de la base de données</p>
                <p className="text-slate-400 text-sm mt-0.5">
                  Toutes les tables : événements, registre, utilisateurs, postes, documents, etc.
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  Format : fichier <code className="text-slate-300">.sql</code> — restaurable sur n'importe quelle base Supabase
                </p>
              </div>
            </div>
            <button
              onClick={downloadSQL}
              disabled={sqlLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              {sqlLoading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Génération en cours...</>
              ) : sqlDone ? (
                <><CheckCircle className="w-4 h-4" /> Téléchargé !</>
              ) : (
                <><Download className="w-4 h-4" /> Télécharger le SQL</>
              )}
            </button>
          </div>

          {/* Code source */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Code className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">Code source du projet</p>
                <p className="text-slate-400 text-sm mt-0.5">
                  Tout le code React, les migrations SQL et les Edge Functions.
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  Utilisez le bouton <strong className="text-slate-300">"Export"</strong> en haut à droite de Bolt.new pour télécharger le ZIP complet du projet.
                </p>
              </div>
            </div>
            <button
              onClick={downloadMigrations}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Télécharger les instructions
            </button>
          </div>
        </div>

        <p className="text-slate-600 text-xs text-center mt-6">
          Page accessible sur <code className="text-slate-500">/backup</code>
        </p>
      </div>
    </div>
  );
}
