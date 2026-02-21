import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate API key against locations
    const { data: location, error: locError } = await supabase
      .from("locations")
      .select("id, user_id, is_active")
      .eq("api_key", apiKey)
      .single();

    if (locError || !location || !location.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_seen
    await supabase
      .from("locations")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", location.id);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const body = req.method !== "GET" ? await req.json() : null;

    // POST /gsm-gateway - heartbeat + sync modems
    if (req.method === "POST" && (!path || path === "gsm-gateway")) {
      const { modems } = body as {
        modems: Array<{
          port_name: string;
          imei?: string;
          operator?: string;
          signal_strength?: number;
          status: string;
          chips: Array<{
            phone_number: string;
            iccid?: string;
            operator?: string;
            status?: string;
          }>;
        }>;
      };

      for (const modem of modems) {
        // Upsert modem
        const { data: existingModem } = await supabase
          .from("modems")
          .select("id")
          .eq("location_id", location.id)
          .eq("port_name", modem.port_name)
          .single();

        let modemId: string;

        if (existingModem) {
          modemId = existingModem.id;
          await supabase
            .from("modems")
            .update({
              imei: modem.imei,
              operator: modem.operator,
              signal_strength: modem.signal_strength,
              status: modem.status,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", modemId);
        } else {
          const { data: newModem } = await supabase
            .from("modems")
            .insert({
              location_id: location.id,
              port_name: modem.port_name,
              imei: modem.imei,
              operator: modem.operator,
              signal_strength: modem.signal_strength,
              status: modem.status,
              last_seen_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          modemId = newModem!.id;
        }

        // Sync chips
        for (const chip of modem.chips || []) {
          const { data: existingChip } = await supabase
            .from("chips")
            .select("id")
            .eq("modem_id", modemId)
            .eq("phone_number", chip.phone_number)
            .single();

          if (existingChip) {
            await supabase
              .from("chips")
              .update({
                iccid: chip.iccid,
                operator: chip.operator,
                status: chip.status || "active",
              })
              .eq("id", existingChip.id);
          } else {
            await supabase.from("chips").insert({
              modem_id: modemId,
              phone_number: chip.phone_number,
              iccid: chip.iccid,
              operator: chip.operator,
              status: chip.status || "active",
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, location_id: location.id }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
