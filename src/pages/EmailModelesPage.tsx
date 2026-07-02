import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ChevronDown, ChevronUp, ArrowLeft, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

type Modele = {
  id: string;
  nom: string;
  badge?: 'commercial';
  trigger: string;
  from: string;
  destinataires: string;
  subject: string;
  html: string;
};

const APP_URL = 'https://maincourante.eu';

function buildActivationHtml(displayName: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
    <div style="width:40px;height:40px;background:#1e3a5f;border:1px solid rgba(37,99,235,0.25);border-radius:10px;text-align:center;line-height:40px;font-size:20px">🛡</div>
    <span style="color:#fff;font-weight:700;font-size:18px">Main Courante</span>
  </div>
  <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Bienvenue${displayName}&nbsp;!</h1>
  <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Vous avez été invité(e) à rejoindre <strong style="color:#e2e8f0">Main Courante</strong>.<br/>Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
  <a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Activer mon compte</a>
  <p style="color:#475569;font-size:12px;margin-top:24px">Ce lien est valable 24 heures. Si vous n'avez pas demandé cette invitation, ignorez cet email.</p>
</div>`;
}

function buildResetHtml(): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
  <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Réinitialisation du mot de passe</h1>
  <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.</p>
  <a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Réinitialiser mon mot de passe</a>
  <p style="color:#475569;font-size:12px;margin-top:24px">Ce lien est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
</div>`;
}

function buildReinvitationHtml(): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
    <div style="width:40px;height:40px;background:#1e3a5f;border:1px solid rgba(37,99,235,0.25);border-radius:10px;text-align:center;line-height:40px;font-size:20px">🛡</div>
    <span style="color:#fff;font-weight:700;font-size:18px">Main Courante</span>
  </div>
  <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Nouvelle invitation</h1>
  <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Vous avez reçu une invitation à rejoindre <strong style="color:#e2e8f0">Main Courante</strong>.<br/>Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
  <a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Activer mon compte</a>
  <p style="color:#475569;font-size:12px;margin-top:24px">Ce lien est valable 24 heures. Si vous n'avez pas demandé cette invitation, ignorez cet email.</p>
</div>`;
}

function buildRapportSoireeHtml(): string {
  const evenements = [
    { heure: '22h14', typeColor: '#3b82f6', typeLabel: 'Sécurité', espace: 'Salle principale', zone: 'Zone VIP', niveau: 'Moyen', agent: 'Jean Dupont', commentaire: 'Conflict mineur résolu' },
    { heure: '23h02', typeColor: '#ef4444', typeLabel: 'SSI', espace: 'Couloir B', zone: '', niveau: 'Élevé', agent: 'Marie Martin', commentaire: 'Fausse alerte — réarmé' },
    { heure: '23h45', typeColor: '#3b82f6', typeLabel: 'Sécurité', espace: 'Entrée', zone: '', niveau: 'Faible', agent: 'Lucas Petit', commentaire: 'Individu éméché reconduit' },
    { heure: '00h30', typeColor: '#10b981', typeLabel: 'Radio', espace: 'Bar', zone: 'Comptoir', niveau: 'Info', agent: 'Jean Dupont', commentaire: 'RAS' },
    { heure: '01h55', typeColor: '#3b82f6', typeLabel: 'Sécurité', espace: 'Sortie', zone: '', niveau: 'Moyen', agent: 'Marie Martin', commentaire: 'Bagarre évitée' },
  ];
  const lignes = evenements.map(e => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:12px 16px;font-size:13px;color:#64748b;white-space:nowrap">${e.heure}</td>
      <td style="padding:12px 16px">
        <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${e.typeColor};background:${e.typeColor}18">${e.typeLabel}</span>
      </td>
      <td style="padding:12px 16px;font-size:13px;color:#374151">${e.espace}${e.zone ? ` <span style="color:#9ca3af">/ ${e.zone}</span>` : ''}</td>
      <td style="padding:12px 16px;font-size:13px;color:#374151">${e.niveau}</td>
      <td style="padding:12px 16px;font-size:13px;color:#374151">${e.agent}</td>
      <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-style:italic">${e.commentaire}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:760px;margin:0 auto">
    <div style="background:#0f172a;border-radius:16px 16px 0 0;padding:36px 40px 28px">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">Main Courante — Rapport automatique</p>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;line-height:1.2">Le Melkior</h1>
    </div>
    <div style="background:#1e293b;padding:18px 40px">
      <p style="color:#e2e8f0;font-size:17px;font-weight:700;margin:0 0 4px">Soirée du mercredi 02 juillet 2026</p>
      <p style="color:#475569;font-size:13px;margin:0">17h00 → 08h00</p>
    </div>
    <div style="background:#f1f5f9;padding:20px 40px;border-bottom:1px solid #e2e8f0">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="14%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#1e293b;font-size:28px;font-weight:700">5</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">Événements</div>
        </td></tr></table></td>
        <td width="14%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#ef4444;font-size:28px;font-weight:700">1</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">SSI</div>
        </td></tr></table></td>
        <td width="14%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#3b82f6;font-size:28px;font-weight:700">3</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">Sécu</div>
        </td></tr></table></td>
        <td width="14%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#22c55e;font-size:28px;font-weight:700">3</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">Agents</div>
        </td></tr></table></td>
        <td width="14%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#22c55e;font-size:28px;font-weight:700">450</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">Visiteurs</div>
        </td></tr></table></td>
        <td width="14%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#f59e0b;font-size:28px;font-weight:700">612</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">Max en salle</div>
        </td></tr></table></td>
        <td width="16%" style="padding:4px"><table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center"><tr><td>
          <div style="color:#60a5fa;font-size:28px;font-weight:700">00h15</div>
          <div style="color:#6b7280;font-size:12px;margin-top:6px">Heure de pointe</div>
        </td></tr></table></td>
      </tr></table>
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;overflow:hidden">
      <div style="padding:24px 40px 16px">
        <h2 style="font-size:15px;font-weight:700;color:#0f172a;margin:0">Journal des événements</h2>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Type</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Espace / Zone</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Niveau</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Agent</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Commentaire</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <div style="padding:20px 40px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
        <p style="font-size:12px;color:#94a3b8;margin:0">Généré automatiquement par Main Courante</p>
        <p style="font-size:12px;color:#94a3b8;margin:0">02 juillet 2026</p>
      </div>
    </div>
  </div>
</body></html>`;
}

function buildRapportTestHtml(): string {
  const lignesActions = [
    { heure: '23h02', color: '#22c55e', label: 'Entrée', delta: '+1', source: 'app' },
    { heure: '23h08', color: '#22c55e', label: 'Entrée', delta: '+5', source: 'app' },
    { heure: '23h14', color: '#f59e0b', label: 'Sortie', delta: '-2', source: 'app' },
    { heure: '23h31', color: '#22c55e', label: 'Entrée', delta: '+3', source: 'zapsis' },
    { heure: '23h50', color: '#f59e0b', label: 'Sortie', delta: '-1', source: 'app' },
  ].map(a => `<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:10px 16px;font-size:13px;color:#64748b;white-space:nowrap">${a.heure}</td>
    <td style="padding:10px 16px"><span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${a.color};background:${a.color}18">${a.label}</span></td>
    <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600">${a.delta}</td>
    <td style="padding:10px 16px;font-size:12px;color:#94a3b8">${a.source}</td>
  </tr>`).join('');

  const lignesEvenements = [
    { heure: '23h20', color: '#3b82f6', label: 'Gestion client', espace: 'Salle VIP' },
    { heure: '23h44', color: '#ef4444', label: 'SSI', espace: 'Couloir A' },
  ].map(e => `<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:10px 16px;font-size:13px;color:#64748b;white-space:nowrap">${e.heure}</td>
    <td style="padding:10px 16px"><span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${e.color};background:${e.color}18">${e.label}</span></td>
    <td style="padding:10px 16px;font-size:13px;color:#374151">${e.espace}</td>
  </tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:720px;margin:0 auto">
    <div style="background:#78350f;border-radius:16px 16px 0 0;padding:36px 40px 28px">
      <p style="color:#fcd34d;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">⚠ SESSION DE TEST — Données non opérationnelles</p>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;line-height:1.2">Le Melkior</h1>
    </div>
    <div style="background:#92400e;padding:18px 40px">
      <p style="color:#fef3c7;font-size:17px;font-weight:700;margin:0 0 4px">Session test du mercredi 02 juillet 2026</p>
      <p style="color:#d97706;font-size:13px;margin:0">23h00 → 03h00 — durée : 240 min</p>
    </div>
    <div style="background:#fffbeb;padding:20px 40px;border-bottom:1px solid #fde68a">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="25%" style="padding:4px"><table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fde68a"><tr><td>
          <div style="color:#92400e;font-size:26px;font-weight:700">7</div>
          <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Max en salle</div>
        </td></tr></table></td>
        <td width="25%" style="padding:4px"><table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fde68a"><tr><td>
          <div style="color:#78350f;font-size:26px;font-weight:700">9</div>
          <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Total entrées</div>
        </td></tr></table></td>
        <td width="25%" style="padding:4px"><table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fca5a5"><tr><td>
          <div style="color:#ef4444;font-size:26px;font-weight:700">1</div>
          <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Événements SSI</div>
        </td></tr></table></td>
        <td width="25%" style="padding:4px"><table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fde68a"><tr><td>
          <div style="color:#3b82f6;font-size:26px;font-weight:700">1</div>
          <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Gestion client</div>
        </td></tr></table></td>
      </tr></table>
      <p style="margin:16px 0 0;font-size:12px;color:#92400e;text-align:center">Heure de pointe : <strong>23h31</strong> — 5 actions Flic enregistrées</p>
    </div>
    <div style="background:#fff;border-top:1px solid #fde68a">
      <div style="padding:20px 40px 12px"><h2 style="font-size:14px;font-weight:700;color:#92400e;margin:0">Journal actions Flic (test)</h2></div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#fffbeb;border-bottom:2px solid #fde68a">
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Action</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Delta</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Source</th>
        </tr></thead>
        <tbody>${lignesActions}</tbody>
      </table>
    </div>
    <div style="background:#fff;border-top:1px solid #f1f5f9;border-radius:0 0 16px 16px;overflow:hidden">
      <div style="padding:20px 40px 12px"><h2 style="font-size:14px;font-weight:700;color:#92400e;margin:0">Événements saisis (test)</h2></div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#fffbeb;border-bottom:2px solid #fde68a">
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Type</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Localisation</th>
        </tr></thead>
        <tbody>${lignesEvenements}</tbody>
      </table>
      <div style="padding:18px 40px;border-top:1px solid #fde68a;background:#fffbeb">
        <p style="font-size:12px;color:#92400e;margin:0;font-weight:600">⚠ Ces données de test ont été purgées automatiquement — elles ne figurent pas dans les rapports de soirée.</p>
        <p style="font-size:11px;color:#b45309;margin:4px 0 0">Généré le 02 juillet 2026 à 03h00</p>
      </div>
    </div>
  </div>
</body></html>`;
}

function buildRegistreInterneHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#0f0f1a;font-family:system-ui,sans-serif;color:#e2e8f0;padding:32px;max-width:680px;margin:0 auto">
  <div style="background:#1a1a2e;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #2d2d3d">
    <h1 style="color:#fff;font-size:20px;margin:0 0 4px">Registre de sécurité</h1>
    <p style="color:#64748b;font-size:13px;margin:0">Le Melkior</p>
  </div>
  <div style="background:#1a1a2e;border-radius:16px;padding:24px;border:1px solid #2d2d3d">
    <h2 style="color:#ef4444;font-size:16px;margin-bottom:12px;border-bottom:2px solid #ef4444;padding-bottom:6px">En retard (2)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#1e1e2e;color:#94a3b8">
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Installation</th>
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Référence</th>
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Retard</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #2d2d3d">
          <td style="padding:8px 12px;font-size:13px;color:#f1f5f9">Installations électriques</td>
          <td style="padding:8px 12px;font-size:12px;color:#94a3b8">NF C 15-100</td>
          <td style="padding:8px 12px;font-size:13px;color:#ef4444;font-weight:600">45 jour(s)</td>
        </tr>
        <tr style="border-bottom:1px solid #2d2d3d">
          <td style="padding:8px 12px;font-size:13px;color:#f1f5f9">Extincteurs</td>
          <td style="padding:8px 12px;font-size:12px;color:#94a3b8">R4 annexe II</td>
          <td style="padding:8px 12px;font-size:13px;color:#ef4444;font-weight:600">12 jour(s)</td>
        </tr>
      </tbody>
    </table>
    <h2 style="color:#f59e0b;font-size:16px;margin-bottom:12px;border-bottom:2px solid #f59e0b;padding-bottom:6px">Échéances à venir (1)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#1e1e2e;color:#94a3b8">
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Installation</th>
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Référence</th>
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Date limite</th>
        <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase">Dans</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #2d2d3d">
          <td style="padding:8px 12px;font-size:13px;color:#f1f5f9">Système de désenfumage</td>
          <td style="padding:8px 12px;font-size:12px;color:#94a3b8">IT 246</td>
          <td style="padding:8px 12px;font-size:13px;color:#f59e0b;font-weight:600">15/08/2026</td>
          <td style="padding:8px 12px;font-size:13px;color:#f59e0b">J-44</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p style="text-align:center;color:#475569;font-size:11px;margin-top:24px">Registre de sécurité — Main Courante — Le Melkior</p>
</body></html>`;
}

function buildRegistreOrganismeHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px;color:#1e293b">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#1e293b;padding:24px 32px">
      <p style="color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:.05em;margin:0 0 8px;text-transform:uppercase">Rappel officiel</p>
      <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;margin:0">Le Melkior</h1>
      <p style="color:#94a3b8;font-size:14px;margin:4px 0 0">Visite(s) périodique(s) à planifier</p>
    </div>
    <div style="padding:32px">
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px">
        Madame, Monsieur,<br><br>
        Nous vous contactons afin de planifier la ou les visite(s) périodique(s) réglementaire(s) concernant notre établissement <strong>Le Melkior</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#f1f5f9">
          <th style="padding:12px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0">Installation</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0">Référence</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0">Échéance</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0">Statut</th>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 16px;font-size:14px;color:#1e293b;font-weight:500">Installations électriques</td>
          <td style="padding:12px 16px;font-size:13px;color:#64748b">NF C 15-100</td>
          <td style="padding:12px 16px;font-size:13px;color:#1e293b">01/06/2026</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#dc2626">En retard · 31 jour(s)</td>
        </tr>
      </table>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Nous restons à votre disposition pour convenir d'une date d'intervention.</p>
      <div style="text-align:center;margin:16px 0">
        <p style="color:#64748b;font-size:13px;font-weight:600;margin:0 0 8px">Installations électriques</p>
        <a href="#" style="display:inline-block;background:#1e293b;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none">✓ Confirmer la prise en compte</a>
        <p style="color:#94a3b8;font-size:12px;margin:12px 0 0">Ce lien est unique et personnel à votre établissement</p>
      </div>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:24px 0 0">Cordialement,<br><strong>Le Melkior</strong></p>
      <div style="margin-top:24px;padding:20px;background:#f8fafc;border-radius:8px;border-left:4px solid #1e293b">
        <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 12px">Coordonnées de l'établissement</p>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:3px 16px 3px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap">Raison sociale</td><td style="padding:3px 0;color:#1e293b;font-size:13px">SARL Le Melkior</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap">Enseigne</td><td style="padding:3px 0;color:#1e293b;font-size:13px">Le Melkior</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap">Adresse</td><td style="padding:3px 0;color:#1e293b;font-size:13px">12 rue de la Paix, 75001 Paris</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap">Téléphone</td><td style="padding:3px 0;color:#1e293b;font-size:13px">01 23 45 67 89</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap">Email</td><td style="padding:3px 0;color:#60a5fa;font-size:13px">contact@lemelkior.fr</td></tr>
        </table>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center">Ce message est généré automatiquement par le système Main Courante</p>
    </div>
  </div>
</body></html>`;
}

function buildIdentifiantsHtml(): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden">
    <div style="padding:32px 32px 24px">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Main Courante</p>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px">Vos identifiants de connexion</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0">Un compte provisoire a été créé pour vous.</p>
    </div>
    <div style="padding:0 32px 24px">
      <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden">
        <tr>
          <td style="padding:12px 16px;background:#1e293b;color:#94a3b8;font-size:13px;font-weight:600;width:110px">Email</td>
          <td style="padding:12px 16px;background:#1e293b;color:#f1f5f9;font-family:monospace;font-size:14px">marie.durand@lemelkior.fr</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#0f172a;border:1px solid #1e293b;color:#94a3b8;font-size:13px;font-weight:600">Mot de passe</td>
          <td style="padding:12px 16px;background:#0f172a;border:1px solid #1e293b;color:#f1f5f9;font-family:monospace;font-size:14px">Melkior2026!</td>
        </tr>
      </table>
    </div>
    <div style="padding:0 32px 24px;text-align:center">
      <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none">${APP_URL}</a>
    </div>
    <div style="padding:16px 32px 28px;border-top:1px solid #1e293b">
      <p style="color:#475569;font-size:12px;margin:0">Ce compte est provisoire (valable 48h). Pensez à compléter votre profil dès votre première connexion.</p>
    </div>
  </div>
</body></html>`;
}

function buildBienvenueHtml(): string {
  const nomEtab = 'Le Melkior';
  const prenom = 'Camille';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#0f172a;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">Bonjour ${prenom},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0">
      Félicitations ! Votre établissement <strong style="color:#1e293b">${nomEtab}</strong> est désormais configuré sur Main Courante.
    </p>
  </div>
  <div style="margin:0 24px 24px;padding:20px 24px;background:#f1f5f9;border-radius:10px">
    <h3 style="color:#0f172a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 16px">Vos coordonnées</h3>
    <table style="width:100%;font-size:14px;color:#334155;border-collapse:collapse">
      <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;width:130px">Établissement</td><td style="padding:5px 0;color:#1e293b">${nomEtab}</td></tr>
      <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b">Enseigne</td><td style="padding:5px 0;color:#1e293b">Le Melkior</td></tr>
      <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b">Type ERP</td><td style="padding:5px 0;color:#1e293b">Type L — 3ème catégorie</td></tr>
      <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b">Effectif max</td><td style="padding:5px 0;color:#1e293b">450 personnes</td></tr>
      <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b">Adresse</td><td style="padding:5px 0;color:#1e293b">12 rue de la Paix, 75001 Paris</td></tr>
    </table>
  </div>
  <div style="padding:0 24px 8px">
    <div style="margin:0 0 14px;padding:16px 18px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af">Protection juridique</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">Chaque événement horodaté constitue une preuve de votre diligence (art. R123-51 CCH).</p>
    </div>
    <div style="margin:0 0 28px;padding:16px 18px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#166534">Conformité réglementaire</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">Registre de sécurité, vérifications périodiques, suivi de l'effectif — tout en un clic.</p>
    </div>
  </div>
  <div style="padding:0 24px 36px;text-align:center">
    <a href="https://maincourante.eu" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">Accéder à mon espace</a>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0">Main Courante — <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a></p>
  </div>
</div></body></html>`;
}

function buildEngagementPrecocePreviewHtml(planLabel: string, joursDepuis: number, joursRestants: number): string {
  const nomEtab = 'Le Melkior';
  const prenom = 'Camille';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#0f172a;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0">Votre essai ${planLabel} — ${joursDepuis} jours déjà !</p>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">Bonjour ${prenom},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">
      Cela fait maintenant <strong>${joursDepuis} jours</strong> que <strong style="color:#1e293b">${nomEtab}</strong> utilise Main Courante.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">
      Il vous reste <strong style="color:#1e293b">${joursRestants} jours</strong> pour profiter pleinement de votre essai.
    </p>
  </div>
  <div style="margin:0 24px;padding:20px 24px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af">Rappel : ce que vous avez déjà à disposition</p>
    <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.8">
      <li>Main courante horodatée et infalsifiable</li>
      <li>Registre de sécurité dématérialisé</li>
      <li>Suivi des effectifs en temps réel</li>
      <li>Rondes et vérifications tracées</li>
    </ul>
  </div>
  <div style="padding:28px 24px;text-align:center">
    <a href="https://maincourante.eu/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">Voir les offres d'abonnement</a>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0">Main Courante — <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a></p>
  </div>
</div></body></html>`;
}

function buildEngagementTardifPreviewHtml(): string {
  const nomEtab = 'Le Melkior';
  const prenom = 'Camille';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#0f172a;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0">Votre essai Testeur — Bilan à 60 jours</p>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">Bonjour ${prenom},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">Cela fait <strong>60 jours</strong> que <strong>${nomEtab}</strong> utilise Main Courante. Voici votre bilan.</p>
  </div>
  <div style="margin:0 24px 24px;display:flex;gap:16px">
    <div style="flex:1;padding:20px;background:#f1f5f9;border-radius:10px;text-align:center">
      <p style="font-size:32px;font-weight:800;color:#2563eb;margin:0">47</p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 0">événements</p>
    </div>
    <div style="flex:1;padding:20px;background:#f1f5f9;border-radius:10px;text-align:center">
      <p style="font-size:32px;font-weight:800;color:#2563eb;margin:0">12</p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 0">rondes</p>
    </div>
    <div style="flex:1;padding:20px;background:#f1f5f9;border-radius:10px;text-align:center">
      <p style="font-size:32px;font-weight:800;color:#2563eb;margin:0">30</p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 0">jours restants</p>
    </div>
  </div>
  <div style="padding:0 24px 8px">
    <div style="padding:16px 18px;background:#fefce8;border-left:4px solid #eab308;border-radius:6px">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#854d0e">Votre essai se termine bientôt</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">Pour ne pas perdre vos données, passez à l'abonnement avant la fin de votre période d'essai.</p>
    </div>
  </div>
  <div style="padding:28px 24px;text-align:center">
    <a href="https://maincourante.eu/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">Choisir mon abonnement</a>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0">Main Courante — <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a></p>
  </div>
</div></body></html>`;
}

function buildUrgenceJ20PreviewHtml(): string {
  const nomEtab = 'Le Melkior';
  const prenom = 'Camille';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#0f172a;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0">Votre essai se termine dans 20 jours</p>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">Bonjour ${prenom},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">La période d'essai de <strong>${nomEtab}</strong> se termine le <strong>22 juillet 2026</strong>.</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">Après cette date, sans abonnement actif, votre accès sera suspendu.</p>
  </div>
  <div style="margin:0 24px 24px;padding:20px 24px;background:#fff7ed;border-left:4px solid #f97316;border-radius:6px">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#9a3412">Ce qui vous attend sans abonnement</p>
    <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.8">
      <li>Accès à l'interface suspendu</li>
      <li>Impossibilité d'enregistrer de nouveaux événements</li>
      <li>Vos données conservées 30 jours supplémentaires</li>
    </ul>
  </div>
  <div style="padding:0 24px 28px;text-align:center">
    <a href="https://maincourante.eu/abonnement" style="display:inline-block;background:#ea580c;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">Voir les offres d'abonnement</a>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0">Main Courante — <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a></p>
  </div>
</div></body></html>`;
}

function buildUrgenceJ5PreviewHtml(): string {
  const nomEtab = 'Le Melkior';
  const prenom = 'Camille';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#dc2626;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:6px 0 0">Plus que 5 jours — Action requise</p>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">Bonjour ${prenom},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px"><strong style="color:#dc2626">Votre essai se termine dans 5 jours</strong>, le 7 juillet 2026.</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">Ne laissez pas votre protection de sécurité de <strong>${nomEtab}</strong> s'interrompre.</p>
  </div>
  <div style="margin:0 24px 28px;padding:20px 24px;background:#fef2f2;border:2px solid #dc2626;border-radius:10px;text-align:center">
    <p style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 12px">5 jours pour sécuriser la continuité de votre établissement</p>
    <p style="color:#475569;font-size:13px;margin:0">Abonnez-vous maintenant pour maintenir votre conformité réglementaire sans interruption.</p>
  </div>
  <div style="padding:0 24px 36px;text-align:center">
    <a href="https://maincourante.eu/abonnement" style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">S'abonner maintenant</a>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0">Main Courante — <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a></p>
  </div>
</div></body></html>`;
}

function buildExpireClientPreviewHtml(): string {
  const nomEtab = 'Le Melkior';
  const prenom = 'Camille';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#64748b;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0">Votre période d'essai est terminée</p>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">Bonjour ${prenom},</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">La période d'essai de <strong>${nomEtab}</strong> est maintenant expirée. Votre accès à Main Courante a été suspendu.</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">Vos données sont conservées et accessibles dès que vous souscrivez un abonnement. Vous pouvez reprendre exactement là où vous en étiez.</p>
  </div>
  <div style="margin:0 24px 24px;padding:20px 24px;background:#f1f5f9;border-radius:10px">
    <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 8px">Vos données sont en sécurité</p>
    <p style="color:#475569;font-size:13px;line-height:1.7;margin:0">Toutes vos entrées main courante, vos rondes, vos registres et vos rapports sont conservés. Un abonnement vous redonne accès instantanément.</p>
  </div>
  <div style="padding:0 24px 28px;text-align:center">
    <a href="https://maincourante.eu/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">Réactiver mon compte</a>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0">Main Courante — <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a></p>
  </div>
</div></body></html>`;
}

function buildExpireEquipePreviewHtml(): string {
  const nomEtab = 'Le Melkior';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#1e293b;padding:24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:18px">Main Courante — Notification interne</span>
    <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">Essai expiré</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 20px">Essai expiré : ${nomEtab}</h2>
    <table style="width:100%;font-size:14px;color:#334155;border-collapse:collapse">
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b;width:160px">Établissement</td><td>${nomEtab}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">ID</td><td style="font-size:12px;font-family:monospace;color:#1e293b">a1b2c3d4-e5f6-7890-abcd-ef1234567890</td></tr>
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Plan</td><td>testeur</td></tr>
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Activation</td><td>2 janvier 2026</td></tr>
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Fin d'essai</td><td>2 juillet 2026</td></tr>
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Direction</td><td>camille.dupont@lemelkior.fr</td></tr>
      <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Événements</td><td>47 enregistrés</td></tr>
    </table>
  </div>
  <div style="padding:0 24px 24px">
    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 18px">
      <p style="margin:0;font-size:13px;color:#7f1d1d">Le statut de cet établissement a été automatiquement mis à jour en <strong>expiré</strong>. Un suivi commercial est recommandé.</p>
    </div>
  </div>
</div></body></html>`;
}

const MODELES: Modele[] = [
  {
    id: 'activation',
    nom: 'Activation de compte',
    trigger: 'Création d\'un utilisateur (bouton "Inviter")',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'L\'utilisateur invité',
    subject: 'Activez votre compte Main Courante',
    html: buildActivationHtml(', Jean'),
  },
  {
    id: 'reinvitation',
    nom: 'Réinvitation',
    trigger: 'Bouton "Renvoyer invitation" (SuperAdmin)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Activez votre compte Main Courante',
    html: buildReinvitationHtml(),
  },
  {
    id: 'reset',
    nom: 'Réinitialisation mot de passe',
    trigger: 'Bouton "Reset password" (SuperAdmin)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Réinitialisation de votre mot de passe Main Courante',
    html: buildResetHtml(),
  },
  {
    id: 'rapport-soiree',
    nom: 'Rapport de soirée',
    trigger: 'Cron automatique ~8h00 chaque matin',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Groupe configuré dans email_rules',
    subject: '[Main Courante] Rapport de soirée — Le Melkior — mercredi 02 juillet 2026',
    html: buildRapportSoireeHtml(),
  },
  {
    id: 'rapport-test',
    nom: 'Rapport session test',
    trigger: 'Fermeture de session test',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction + Chef de Poste (email_rules)',
    subject: '[Main Courante] Rapport session test — Le Melkior — mercredi 02 juillet 2026 23h00→03h00',
    html: buildRapportTestHtml(),
  },
  {
    id: 'registre-interne',
    nom: 'Alerte registre (interne)',
    trigger: 'Cron selon fréquence configurée',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Groupe interne (email_rules)',
    subject: '[Main Courante] Registre de sécurité — 3 vérification(s) à traiter — Le Melkior',
    html: buildRegistreInterneHtml(),
  },
  {
    id: 'registre-organisme',
    nom: 'Rappel registre (organisme)',
    trigger: 'Cron selon fréquence configurée',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Email organisme vérificateur (registre_securite.email_organisme)',
    subject: '[Main Courante] Rappel de visite périodique — Installations électriques — Le Melkior',
    html: buildRegistreOrganismeHtml(),
  },
  {
    id: 'identifiants',
    nom: 'Identifiants provisoires',
    trigger: 'Endpoint send-credentials (onboarding)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Email du compte créé',
    subject: '[Main Courante] Vos identifiants de connexion',
    html: buildIdentifiantsHtml(),
  },
  {
    id: 'test-custom',
    nom: 'Email de test personnalisé',
    trigger: 'Bouton "Tester" dans EmailsPage',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Destinataires configurés dans email_rules',
    subject: 'Personnalisé (paramètre de l\'appelant)',
    html: `<div style="font-family:system-ui,sans-serif;padding:32px;background:#f8fafc;max-width:600px;margin:0 auto">
  <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:16px">
    <h1 style="color:#fff;font-size:18px;margin:0">Test d'envoi — Rapport de soirée</h1>
    <p style="color:#64748b;font-size:13px;margin:8px 0 0">Main Courante</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
    <p style="color:#374151;font-size:14px;margin:0">Ceci est un email de test pour la règle <strong>Rapport de soirée</strong>.</p>
    <p style="color:#64748b;font-size:13px;margin:12px 0 0">Destinataires : direction@lemelkior.fr, chef@lemelkior.fr</p>
  </div>
</div>`,
  },
  {
    id: 'obligations',
    nom: 'Obligations réglementaires',
    trigger: 'Bouton "Envoyer mes obligations" dans EntreprisePage',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Tous les utilisateurs Direction de l\'établissement',
    subject: '[Main Courante] Mes obligations réglementaires — Le Melkior',
    html: `<div style="font-family:system-ui,sans-serif;padding:32px;background:#f8fafc;max-width:600px;margin:0 auto">
  <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:16px">
    <h1 style="color:#fff;font-size:18px;margin:0">Obligations réglementaires</h1>
    <p style="color:#64748b;font-size:13px;margin:8px 0 0">Le Melkior — ERP Type L, 3ème catégorie</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;color:#374151;font-size:14px;line-height:1.7">
    <p style="margin:0 0 12px;font-weight:600;color:#0f172a">Ce document contient le HTML généré par l'IA et stocké dans <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px">etablissements.document_obligations_html</code>.</p>
    <p style="margin:0;color:#64748b">Le contenu varie selon le questionnaire rempli lors de l'onboarding (catégorie ERP, type, activités).</p>
  </div>
</div>`,
  },
  {
    id: 'bienvenue',
    badge: 'commercial',
    nom: 'Bienvenue post-onboarding',
    trigger: 'Activation du compte client (fin d\'onboarding)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Bienvenue dans Main Courante — Votre sécurité, notre priorité',
    html: buildBienvenueHtml(),
  },
  {
    id: 'engagement-j30',
    badge: 'commercial',
    nom: 'Engagement J+30 (Testeur) / J+15 (Light)',
    trigger: 'Cron quotidien 10h — si jours_depuis ≥ 30 (Testeur) ou ≥ 15 (Light)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Le Melkior — 30 jours sur Main Courante',
    html: buildEngagementPrecocePreviewHtml('Testeur', 30, 60),
  },
  {
    id: 'engagement-j60',
    badge: 'commercial',
    nom: 'Engagement J+60 (Testeur) avec bilan',
    trigger: 'Cron quotidien 10h — si jours_depuis ≥ 60 (Testeur uniquement)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Le Melkior — Bilan à 60 jours sur Main Courante',
    html: buildEngagementTardifPreviewHtml(),
  },
  {
    id: 'urgence-j20',
    badge: 'commercial',
    nom: 'Urgence J-20',
    trigger: 'Cron quotidien 10h — si jours_restants ≤ 20 et > 5',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Votre essai Main Courante se termine bientôt',
    html: buildUrgenceJ20PreviewHtml(),
  },
  {
    id: 'urgence-j5',
    badge: 'commercial',
    nom: 'Urgence J-5',
    trigger: 'Cron quotidien 10h — si jours_restants ≤ 5',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: '⚠️ Plus que 5 jours — Votre essai se termine bientôt',
    html: buildUrgenceJ5PreviewHtml(),
  },
  {
    id: 'expire-client',
    badge: 'commercial',
    nom: 'Essai expiré (client)',
    trigger: 'Cron quotidien 10h — si jours_restants ≤ 0 (envoi unique)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'Direction de l\'établissement',
    subject: 'Votre essai Main Courante est terminé',
    html: buildExpireClientPreviewHtml(),
  },
  {
    id: 'expire-equipe',
    badge: 'commercial',
    nom: 'Essai expiré (équipe interne)',
    trigger: 'Cron quotidien 10h — si jours_restants ≤ 0 (envoi unique)',
    from: 'noreply@send.maincourante.eu',
    destinataires: 'contact@maincourante.eu (équipe)',
    subject: '[Interne] Essai expiré — Le Melkior',
    html: buildExpireEquipePreviewHtml(),
  },
];

export default function EmailModelesPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppHeader onSignOut={signOut} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <button
            onClick={() => navigate('/emails')}
            className="mt-1 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Modèles de mail</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Aperçu de tous les emails envoyés par Main Courante — données fictives à titre d'exemple.
            </p>
          </div>
        </div>

        {/* Badge count */}
        <div className="flex items-center gap-2 mb-6">
          <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            {MODELES.length} modèles
          </span>
          <span className="text-slate-600 text-xs">noreply@send.maincourante.eu</span>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {MODELES.map((m) => {
            const isOpen = openId === m.id;
            return (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
              >
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Mail className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{m.nom}</p>
                          {m.badge === 'commercial' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 border border-amber-500/25 text-amber-400 shrink-0">
                              Commercial
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">
                          <span className="text-slate-600">Trigger :</span> {m.trigger}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">
                          <span className="text-slate-600">Destinataires :</span> {m.destinataires}
                        </p>
                        <p className="text-slate-600 text-xs mt-1 font-mono truncate">
                          {m.subject}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shrink-0
                        text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
                        hover:border-slate-600 transition-all"
                    >
                      {isOpen ? (
                        <>Fermer <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>Voir l'aperçu <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadata strip */}
                <div className="px-5 pb-3 flex flex-wrap gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-600">From :</span>
                    <span className="font-mono text-slate-400">{m.from}</span>
                  </span>
                </div>

                {/* Preview */}
                {isOpen && (
                  <div className="border-t border-slate-800">
                    <div className="px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Aperçu — données fictives</span>
                    </div>
                    <div className="mx-4 mb-4 rounded-xl overflow-hidden border border-slate-700 bg-white">
                      <iframe
                        srcDoc={m.html}
                        title={`Aperçu — ${m.nom}`}
                        className="w-full border-0"
                        style={{ height: '500px' }}
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
