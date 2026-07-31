import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WORKER_URL = "https://api.share-brasil.com";

interface AnexoIn {
  filename?: string;
  url?: string;
  label?: string;
}

interface Body {
  to?: string;
  cc?: string | null;
  assunto?: string;
  mensagem?: string;
  anexos?: AnexoIn[];
  tipo?: string | null;
  reference_type?: string | null;
  reference_ids?: string[];
}

const escapeHtml = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function buildHtml(
  mensagem: string,
  links: { label: string; url: string }[],
) {
  const corpo = escapeHtml(mensagem)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const anexosHtml = links.length
    ? `<div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb">
         <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.04em">Documentos</p>
         ${links
           .map(
             (l) =>
               `<p style="margin:0 0 8px"><a href="${l.url}" style="color:#0369a1;font-weight:600;text-decoration:none">📄 ${escapeHtml(l.label)}</a></p>`,
           )
           .join("")}
       </div>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
      <div style="font-size:13px;color:#0369a1;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px">Share Brasil — Financeiro</div>
      ${corpo}
      ${anexosHtml}
      <p style="margin:28px 0 0;font-size:11px;color:#9ca3af">Mensagem enviada automaticamente pelo sistema financeiro Share Brasil.</p>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalToken = Deno.env.get("WORKER_INTERNAL_TOKEN") ?? "";

    if (!internalToken) {
      return new Response(
        JSON.stringify({ error: "WORKER_INTERNAL_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const to = (body.to ?? "").trim();
    const assunto = (body.assunto ?? "").trim();
    const mensagem = (body.mensagem ?? "").trim();

    if (!isEmail(to)) {
      return new Response(JSON.stringify({ error: "E-mail do destinatário inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!assunto || assunto.length > 300) {
      return new Response(JSON.stringify({ error: "Assunto obrigatório (máx. 300 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!mensagem || mensagem.length > 10000) {
      return new Response(JSON.stringify({ error: "Mensagem obrigatória (máx. 10000 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cc = body.cc && isEmail(body.cc) ? body.cc.trim() : null;
    const anexos = Array.isArray(body.anexos) ? body.anexos.slice(0, 12) : [];

    // ─── Republica cada anexo no Worker (R2) e gera link curto próprio ──────
    const links: { label: string; url: string }[] = [];
    for (const anexo of anexos) {
      const url = (anexo?.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      const label = (anexo?.label || anexo?.filename || "Documento").slice(0, 120);
      const filename = (anexo?.filename || "documento.pdf").replace(/[^\w.\-]/g, "_").slice(0, 120);

      try {
        const fileRes = await fetch(url);
        if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
        const blob = await fileRes.blob();

        const form = new FormData();
        form.append("file", blob, filename);
        form.append("folder", "financeiro");

        const upRes = await fetch(`${WORKER_URL}/api/upload`, {
          method: "POST",
          headers: { "x-internal-token": internalToken },
          body: form,
        });
        const upBody = await upRes.text();
        if (!upRes.ok) throw new Error(`upload ${upRes.status}: ${upBody}`);
        const parsed = JSON.parse(upBody);
        links.push({ label, url: parsed.url });
      } catch (e) {
        console.error("[anexo] falha ao republicar", label, String(e));
        links.push({ label, url }); // fallback: link original
      }
    }

    const html = buildHtml(mensagem, links);

    const sendRes = await fetch(`${WORKER_URL}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": internalToken,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        to,
        cc: cc ? [cc] : undefined,
        subject: assunto,
        html,
        tipo: body.tipo ?? "solicitacao_pagamento",
        reference_type: body.reference_type ?? null,
        reference_id: body.reference_ids?.[0] ?? null,
      }),
    });

    const sendText = await sendRes.text();
    let sendJson: any = null;
    try { sendJson = JSON.parse(sendText); } catch { /* texto puro */ }

    const admin = createClient(supabaseUrl, serviceKey);
    const refs = (body.reference_ids ?? []).filter(Boolean);
    const baseRow = {
      tipo: body.tipo ?? "solicitacao_pagamento",
      reference_type: body.reference_type ?? null,
      destinatario: to,
      cc,
      assunto,
      mensagem,
      anexos: links,
      status: sendRes.ok ? "enviado" : "erro",
      erro_mensagem: sendRes.ok ? null : sendText.slice(0, 800),
      provider_id: sendJson?.id ?? null,
      enviado_por: userData.user.id,
    };
    const rows = refs.length
      ? refs.map((id) => ({ ...baseRow, reference_id: id }))
      : [{ ...baseRow, reference_id: null }];

    const { error: logErr } = await admin.from("emails_enviados").insert(rows);
    if (logErr) console.error("[log] falha ao registrar envio:", logErr.message);

    if (!sendRes.ok) {
      console.error("[send-email] erro do worker:", sendRes.status, sendText);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar e-mail", status: sendRes.status, details: sendText }),
        { status: sendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, links, provider: sendJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[enviar-email-cliente]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
