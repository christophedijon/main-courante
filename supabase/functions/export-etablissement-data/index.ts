import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Tables scoped directly by etablissement_id ──
const DIRECT_TABLES = [
  "etablissements",
  "managed_users",
  "super_admins",
  "espaces",
  "zones",
  "zones_ssi",
  "beacons",
  "evenements",
  "event_commentaires",
  "motifs",
  "motifs_ssi",
  "niveaux_intervention",
  "postes",
  "assignations",
  "toolbox_documents",
  "signatures",
  "company_documents",
  "evacuation_plans",
  "rapports_soiree",
  "rapport_email_settings",
  "email_rules",
  "registre_securite",
  "registre_historique",
  "registre_signatures",
  "rondes_config",
  "rondes_passages",
  "rondes_rapports",
  "jauge_etat",
  "jauge_actions",
  "flic_buttons",
  "editor_sessions",
  "reminder_logs",
];

// ── Tables scoped indirectly (via parent FK) ──
// evenement_medias → evenements.evenement_id
// evenement_motifs → evenements.evenement_id
// rondes_config_balises → rondes_config.ronde_config_id
// user_profiles → managed_users.auth_user_id (auth.users.id)
// user_formations → managed_users.auth_user_id (auth.users.id)
// ia_historique → managed_users.auth_user_id (agent_id)

interface TableSpec {
  table: string;
  parentTable: string;
  parentColumn: string; // column in parent table that holds etablissement_id
  childColumn: string;  // column in child table that references parent
  viaAuth?: boolean;     // true if join goes through auth.users
}

const INDIRECT_TABLES: TableSpec[] = [
  { table: "evenement_medias", parentTable: "evenements", parentColumn: "id", childColumn: "evenement_id" },
  { table: "evenement_motifs", parentTable: "evenements", parentColumn: "id", childColumn: "evenement_id" },
  { table: "rondes_config_balises", parentTable: "rondes_config", parentColumn: "id", childColumn: "ronde_config_id" },
  { table: "user_profiles", parentTable: "managed_users", parentColumn: "auth_user_id", childColumn: "id", viaAuth: true },
  { table: "user_formations", parentTable: "managed_users", parentColumn: "auth_user_id", childColumn: "user_id", viaAuth: true },
  { table: "ia_historique", parentTable: "managed_users", parentColumn: "auth_user_id", childColumn: "agent_id", viaAuth: true },
];

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    val = JSON.stringify(val);
  }
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

// Minimal ZIP writer (store-only, no compression) — produces a valid .zip
// CRC32 lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}

function uint32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function buildZip(files: { name: string; content: string }[]): Uint8Array {
  const chunks: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const dataBytes = new TextEncoder().encode(file.content);
    const crc = crc32(dataBytes);

    // Local file header
    const localHeader = [
      ...uint32(0x04034b50), // signature
      ...uint16(20),        // version needed
      ...uint16(0),         // flags
      ...uint16(0),         // compression (store)
      ...uint16(0),         // mod time
      ...uint16(0),         // mod date
      ...uint32(crc),       // crc32
      ...uint32(dataBytes.length), // compressed size
      ...uint32(dataBytes.length), // uncompressed size
      ...uint16(nameBytes.length), // filename length
      ...uint16(0),         // extra field length
      ...Array.from(nameBytes),
    ];
    chunks.push(...localHeader, ...Array.from(dataBytes));

    // Central directory entry
    centralDir.push(
      ...uint32(0x02014b50), // signature
      ...uint16(20),         // version made by
      ...uint16(20),         // version needed
      ...uint16(0),          // flags
      ...uint16(0),          // compression
      ...uint16(0),          // mod time
      ...uint16(0),          // mod date
      ...uint32(crc),
      ...uint32(dataBytes.length),
      ...uint32(dataBytes.length),
      ...uint16(nameBytes.length),
      ...uint16(0),          // extra field length
      ...uint16(0),          // comment length
      ...uint16(0),          // disk number
      ...uint16(0),          // internal attrs
      ...uint32(0),          // external attrs
      ...uint32(offset),     // offset of local header
      ...Array.from(nameBytes),
    );

    offset += localHeader.length + dataBytes.length;
  }

  const cdStart = offset;
  const cdSize = centralDir.length;

  // End of central directory
  const endRecord = [
    ...uint32(0x06054b50),
    ...uint16(0),         // disk number
    ...uint16(0),         // disk with CD
    ...uint16(files.length),
    ...uint16(files.length),
    ...uint32(cdSize),
    ...uint32(cdStart),
    ...uint16(0),         // comment length
  ];

  chunks.push(...centralDir, ...endRecord);
  return new Uint8Array(chunks);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return jsonResp({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const etablissement_id = body?.etablissement_id;
    if (!etablissement_id) return jsonResp({ error: "Missing etablissement_id" }, 400);

    // ── Authorization: caller must own this etablissement OR be super admin ──
    const { data: callerEtabId } = await callerClient
      .rpc("get_user_etablissement_id");

    const { data: isSuperAdmin } = await callerClient
      .rpc("is_super_admin");

    const authorized = isSuperAdmin === true || callerEtabId === etablissement_id;
    if (!authorized) return jsonResp({ error: "Forbidden" }, 403);

    // ── Get etablissement name for filename ──
    const { data: etab } = await adminClient
      .from("etablissements")
      .select("nom, enseigne")
      .eq("id", etablissement_id)
      .maybeSingle();

    if (!etab) return jsonResp({ error: "Établissement non trouvé" }, 404);

    const etabName = (etab.enseigne || etab.nom || "etablissement")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const zipName = `export_${etabName}_${dateStr}.zip`;

    const csvFiles: { name: string; content: string }[] = [];
    const tableLog: { table: string; rows: number }[] = [];

    // ── Export etablissements (filtered by id) ──
    // Direct tables: select * where etablissement_id = X
    for (const table of DIRECT_TABLES) {
      let query = adminClient.from(table).select("*");
      if (table === "etablissements") {
        query = query.eq("id", etablissement_id);
      } else {
        query = query.eq("etablissement_id", etablissement_id);
      }
      const { data, error } = await query;
      if (error) {
        console.error(`[export] ${table}: ${error.message}`);
        tableLog.push({ table, rows: -1 });
        continue;
      }
      const rows = data ?? [];
      if (rows.length > 0) {
        csvFiles.push({
          name: `${table}.csv`,
          content: rowsToCsv(rows as Record<string, unknown>[]),
        });
      }
      tableLog.push({ table, rows: rows.length });
    }

    // ── Indirect tables: fetch parent IDs, then select children ──
    for (const spec of INDIRECT_TABLES) {
      // Get parent IDs scoped to this etablissement
      let parentIds: string[] = [];

      if (spec.viaAuth) {
        // managed_users.auth_user_id for this etablissement
        const { data: muRows } = await adminClient
          .from("managed_users")
          .select("auth_user_id")
          .eq("etablissement_id", etablissement_id);
        parentIds = (muRows ?? [])
          .map((r: { auth_user_id: string | null }) => r.auth_user_id)
          .filter(Boolean) as string[];
      } else {
        // Parent table IDs scoped by etablissement_id
        const { data: parentRows } = await adminClient
          .from(spec.parentTable)
          .select(spec.parentColumn)
          .eq("etablissement_id", etablissement_id);
        parentIds = (parentRows ?? []).map(
          (r: Record<string, unknown>) => String(r[spec.parentColumn]),
        );
      }

      if (parentIds.length === 0) {
        tableLog.push({ table: spec.table, rows: 0 });
        continue;
      }

      const { data, error } = await adminClient
        .from(spec.table)
        .select("*")
        .in(spec.childColumn, parentIds);

      if (error) {
        console.error(`[export] ${spec.table}: ${error.message}`);
        tableLog.push({ table: spec.table, rows: -1 });
        continue;
      }
      const rows = data ?? [];
      if (rows.length > 0) {
        csvFiles.push({
          name: `${spec.table}.csv`,
          content: rowsToCsv(rows as Record<string, unknown>[]),
        });
      }
      tableLog.push({ table: spec.table, rows: rows.length });
    }

    // ── Build ZIP ──
    const zipBytes = buildZip(csvFiles);

    // ── Upload to storage bucket with 1h expiry ──
    const bucketName = "exports";
    const objectPath = `${etablissement_id}/${zipName}`;

    // Ensure bucket exists (idempotent)
    await adminClient.storage.createBucket(bucketName, { public: false }).catch(() => {});

    const { error: uploadErr } = await adminClient.storage
      .from(bucketName)
      .upload(objectPath, zipBytes, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[export] upload:", uploadErr.message);
      return jsonResp({ error: "Erreur lors de l'upload du fichier" }, 500);
    }

    const { data: signedUrlData, error: signedErr } = await adminClient.storage
      .from(bucketName)
      .createSignedUrl(objectPath, 3600);

    if (signedErr || !signedUrlData?.signedUrl) {
      console.error("[export] signed url:", signedErr?.message ?? "no url");
      return jsonResp({ error: "Erreur lors de la génération du lien" }, 500);
    }

    return jsonResp({
      success: true,
      download_url: signedUrlData.signedUrl,
      filename: zipName,
      tables: tableLog,
    });
  } catch (err) {
    console.error("[export] unhandled:", err);
    return jsonResp({ error: "An error occurred" }, 500);
  }
});
