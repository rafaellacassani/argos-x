import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { file_base64, workspace_id } = await req.json();

    if (!file_base64 || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "file_base64 and workspace_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to Uint8Array
    const binaryString = atob(file_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const workbook = XLSX.read(bytes, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

    // Dedup by CNPJ (keep last occurrence)
    const cnpjMap = new Map<string, Record<string, any>>();
    const noCnpjRows: Record<string, any>[] = [];

    for (const row of rows) {
      const cnpj = String(row["CNPJ"] || "").trim();
      if (cnpj) {
        cnpjMap.set(cnpj, row);
      } else {
        noCnpjRows.push(row);
      }
    }

    const uniqueRows = [...cnpjMap.values(), ...noCnpjRows];

    const clients = uniqueRows.map((row) => {
      const statusCliente = String(row["Status do cliente"] || "").trim();
      const isPerdido = statusCliente === "Perdido";

      return {
        workspace_id,
        razao_social: String(row["Razão Social"] || row["Nome Fantasia"] || "Sem nome"),
        nome_fantasia: row["Nome Fantasia"] ? String(row["Nome Fantasia"]) : null,
        cnpj: row["CNPJ"] ? String(row["CNPJ"]).trim() : null,
        pais: "Brasil",
        endereco: row["Endereço completo"] ? String(row["Endereço completo"]) : null,
        numero: row["Número"] ? String(row["Número"]) : null,
        bairro: row["Cidade"] ? String(row["Cidade"]) : null,
        municipio: row["Município"] || row["Cidade"] ? String(row["Município"] || row["Cidade"]) : null,
        estado: row["Estado"] ? String(row["Estado"]) : null,
        cep: row["CEP"] ? String(row["CEP"]) : null,
        socio_nome: String(
          row["Nome do sócio que assina o contrato"] ||
          row["Nome do principal stakeholder"] ||
          row["Razão Social"] ||
          "N/A"
        ),
        socio_cpf: row["CPF do sócio que assina o contrato"]
          ? String(row["CPF do sócio que assina o contrato"])
          : null,
        socio_email: row["E-mail do principal stakeholder"]
          ? String(row["E-mail do principal stakeholder"]).replace(/\//g, "")
          : null,
        socio_telefone: row["Celular do sócio que assinou o contrato"]
          ? String(row["Celular do sócio que assinou o contrato"])
          : null,
        stakeholder_nome: row["Nome do principal stakeholder"]
          ? String(row["Nome do principal stakeholder"])
          : null,
        stakeholder_email: row["E-mail do principal stakeholder"]
          ? String(row["E-mail do principal stakeholder"]).replace(/\//g, "")
          : null,
        financeiro_email: row["E-mail do financeiro"]
          ? String(row["E-mail do financeiro"]).replace(/\//g, "")
          : null,
        pacote: row["Pacote contratado"]
          ? String(row["Pacote contratado"])
          : "Express",
        valor_negociado: 0,
        data_inicio_pagamento: row["Data de ingresso"]
          ? String(row["Data de ingresso"]).substring(0, 10)
          : null,
        negociacoes_personalizadas: row["Negociações personalizadas do pacote"]
          ? String(row["Negociações personalizadas do pacote"])
          : null,
        status: isPerdido ? "Perdido" : "Ativo",
        stage: isPerdido ? "Cancelado" : "Ativo",
        closer: row["Closer responsável "] || row["Closer responsável"]
          ? String(row["Closer responsável "] || row["Closer responsável"]).trim()
          : null,
        bdr: null,
      };
    });

    // Insert in batches of 50
    let inserted = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      const { error } = await supabase.from("clients").insert(batch);
      if (error) {
        console.error("Batch error:", error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        total_rows: rows.length,
        unique_after_dedup: uniqueRows.length,
        inserted,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
