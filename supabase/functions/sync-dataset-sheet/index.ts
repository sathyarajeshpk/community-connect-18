import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimal CSV parser supporting quoted fields & escaped quotes
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => v && v.trim() !== ""));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Verify caller is an admin
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const payloadSheetUrl = typeof payload?.sheet_url === "string" ? payload.sheet_url.trim() : "";

    // Get sheet URL from request payload (preferred) or settings fallback
    const { data: setting } = await admin.from("settings").select("value").eq("key", "google_sheet_url").maybeSingle();
    const settingSheetUrl = setting?.value ? (typeof setting.value === "string" ? setting.value : (setting.value as any).url) : null;
    const sheetUrl = payloadSheetUrl || settingSheetUrl;
    if (!sheetUrl) {
      return new Response(JSON.stringify({ error: "No Google Sheet URL configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Convert any sheet URL to CSV export URL
    const m = String(sheetUrl).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) {
      return new Response(JSON.stringify({ error: "Invalid Google Sheets URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const id = m[1];
    const gidMatch = String(sheetUrl).match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

    const res = await fetch(csvUrl, { redirect: "follow" });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Sheet fetch failed (${res.status}). Make sure it's shared as 'Anyone with the link can view'.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const csv = await res.text();
    const rows = parseCSV(csv);
    if (rows.length < 2) {
      return new Response(JSON.stringify({ error: "Sheet has no data rows" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const headers = rows[0].map(norm);
    const findIdx = (...keys: string[]) => {
      for (const k of keys) {
        const i = headers.indexOf(norm(k));
        if (i >= 0) return i;
      }
      return -1;
    };
    const iPlot = findIdx("plotnumber", "plotno", "plot", "flat", "flatnumber");
    const iName = findIdx("residentname", "ownername", "owner", "resident", "name");
    const iPhone = findIdx("phonenumber", "phone", "mobile", "mobilenumber", "contact");
    const iEmail = findIdx("emailoptional", "email", "emailid", "mail");

    if (iPlot < 0) {
      return new Response(JSON.stringify({ error: "Could not find Plot column. Header row required." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clean = (v: string | undefined) => {
      if (!v) return null;
      let s = String(v).trim();
      if (!s) return null;
      if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
      return s;
    };

    const dedupRows = new Map<string, { plot_number: string; owner_name: string | null; phone: string | null; email: string | null }>();
    for (const r of rows.slice(1)) {
      const plot = clean(r[iPlot]);
      if (!plot) continue;
      const next = {
        plot_number: plot,
        owner_name: iName >= 0 ? clean(r[iName]) : null,
        phone: iPhone >= 0 ? clean(r[iPhone]) : null,
        email: iEmail >= 0 ? clean(r[iEmail])?.toLowerCase() ?? null : null,
      };
      const dedupKey = [next.plot_number, next.owner_name ?? "", next.email ?? "", next.phone ?? ""]
        .map((v) => String(v).trim().toLowerCase())
        .join("|");
      dedupRows.set(dedupKey, next);
    }
    const entries = Array.from(dedupRows.values());

    if (entries.length === 0) {
      return new Response(JSON.stringify({ error: "No valid rows found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: delErr } = await admin.from("dataset_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw delErr;
    const { error: insertErr } = await admin.from("dataset_entries").insert(entries);
    if (insertErr) throw insertErr;

    // Update last sync time
    await admin.from("settings").upsert({ key: "google_sheet_last_sync", value: { at: new Date().toISOString(), count: entries.length } as any }, { onConflict: "key" });

    return new Response(JSON.stringify({ ok: true, count: entries.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
