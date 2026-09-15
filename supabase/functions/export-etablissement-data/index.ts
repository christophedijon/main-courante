import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

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

// ── Tables scoped directly by etablissement_id (v2 xlsx) ──
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

interface TableSpec {
  table: string;
  parentTable: string;
  parentColumn: string;
  childColumn: string;
  viaAuth?: boolean;
}

const INDIRECT_TABLES: TableSpec[] = [
  { table: "evenement_medias", parentTable: "evenements", parentColumn: "id", childColumn: "evenement_id" },
  { table: "evenement_motifs", parentTable: "evenements", parentColumn: "id", childColumn: "evenement_id" },
  { table: "rondes_config_balises", parentTable: "rondes_config", parentColumn: "id", childColumn: "ronde_config_id" },
  { table: "user_profiles", parentTable: "managed_users", parentColumn: "auth_user_id", childColumn: "id", viaAuth: true },
  { table: "user_formations", parentTable: "managed_users", parentColumn: "auth_user_id", childColumn: "user_id", viaAuth: true },
  { table: "ia_historique", parentTable: "managed_users", parentColumn: "auth_user_id", childColumn: "agent_id", viaAuth: true },
];

function truncateSheetName(name: string): string {
  return name.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);
}

function cellValue(val: unknown): string | number | boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function buildSheetData(
  rows: Record<string, unknown>[],
  fallbackHeaders: string[],
): (string | number | boolean | null)[][] {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : fallbackHeaders;

  const result: (string | number | boolean | null)[][] = [headers];

  for (const row of rows) {
    result.push(headers.map((h) => cellValue(row[h])));
  }

  return result;
}

function autoSizeColumns(
  ws: XLSX.WorkSheet,
  data: (string | number | boolean | null)[][],
): void {
  if (data.length === 0) return;
  const colCount = data[0].length;
  for (let c = 0; c < colCount; c++) {
    let maxLen = 10;
    for (let r = 0; r < data.length; r++) {
      const v = data[r][c];
      const s = v === null || v === undefined ? "" : String(v);
      if (s.length > maxLen) maxLen = s.length;
    }
    ws["!cols"] = ws["!cols"] ?? [];
    ws["!cols"][c] = { wch: Math.min(maxLen + 2, 50) };
  }
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
    const fileName = `export_${etabName}_${dateStr}.xlsx`;

    const tableLog: { table: string; rows: number }[] = [];
    const allTables: { name: string; rows: Record<string, unknown>[] }[] = [];

    // ── Direct tables ──
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
      const rows = (data ?? []) as Record<string, unknown>[];
      allTables.push({ name: table, rows });
      tableLog.push({ table, rows: rows.length });
    }

    // ── Indirect tables ──
    for (const spec of INDIRECT_TABLES) {
      let parentIds: string[] = [];

      if (spec.viaAuth) {
        const { data: muRows } = await adminClient
          .from("managed_users")
          .select("auth_user_id")
          .eq("etablissement_id", etablissement_id);
        parentIds = (muRows ?? [])
          .map((r: { auth_user_id: string | null }) => r.auth_user_id)
          .filter(Boolean) as string[];
      } else {
        const { data: parentRows } = await adminClient
          .from(spec.parentTable)
          .select(spec.parentColumn)
          .eq("etablissement_id", etablissement_id);
        parentIds = (parentRows ?? []).map(
          (r: Record<string, unknown>) => String(r[spec.parentColumn]),
        );
      }

      let rows: Record<string, unknown>[] = [];
      if (parentIds.length > 0) {
        const { data, error } = await adminClient
          .from(spec.table)
          .select("*")
          .in(spec.childColumn, parentIds);
        if (error) {
          console.error(`[export] ${spec.table}: ${error.message}`);
          tableLog.push({ table: spec.table, rows: -1 });
          continue;
        }
        rows = (data ?? []) as Record<string, unknown>[];
      }
      allTables.push({ name: spec.table, rows });
      tableLog.push({ table: spec.table, rows: rows.length });
    }

    // ── Fetch column names for empty tables ──
    const emptyTables = allTables.filter((t) => t.rows.length === 0).map((t) => t.name);
    const headerMap = new Map<string, string[]>();
    if (emptyTables.length > 0) {
      const { data: colData } = await adminClient
        .rpc("get_table_columns", { table_names: emptyTables })
        .catch(() => ({ data: null, error: null }));
      if (colData && Array.isArray(colData)) {
        for (const row of colData as { table_name: string; column_name: string }[]) {
          const cols = headerMap.get(row.table_name) ?? [];
          cols.push(row.column_name);
          headerMap.set(row.table_name, cols);
        }
      }
    }

    // ── Build workbook with one sheet per table ──
    const wb = XLSX.utils.book_new();
    let sheetCount = 0;

    for (const t of allTables) {
      const fallbackHeaders = headerMap.get(t.name) ?? [];
      const sheetData = buildSheetData(t.rows, fallbackHeaders);
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      autoSizeColumns(ws, sheetData);
      XLSX.utils.book_append_sheet(wb, ws, truncateSheetName(t.name));
      sheetCount++;
    }

    // ── Generate xlsx buffer ──
    const xlsxArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const xlsxBytes = new Uint8Array(xlsxArrayBuffer);

    // ── Upload to storage bucket with 1h expiry ──
    const bucketName = "exports";
    const objectPath = `${etablissement_id}/${fileName}`;

    await adminClient.storage.createBucket(bucketName, { public: false }).catch(() => {});

    const { error: uploadErr } = await adminClient.storage
      .from(bucketName)
      .upload(objectPath, xlsxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
      filename: fileName,
      sheet_count: sheetCount,
      tables: tableLog,
    });
  } catch (err) {
    console.error("[export] unhandled:", err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err));
    return jsonResp({ error: "An error occurred", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
