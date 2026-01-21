import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const app = new Hono().basePath("/evolution-api");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Normalize the API URL - remove trailing /manager if present
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

// Helper function to make requests to Evolution API
async function evolutionRequest(
  endpoint: string,
  method: string = "GET",
  body?: Record<string, unknown>
) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  console.log(`[Evolution API] ${method} ${url}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": EVOLUTION_API_KEY!,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(`[Evolution API] Non-JSON response: ${text.substring(0, 200)}`);
    throw new Error(`Evolution API returned non-JSON response (status: ${response.status})`);
  }
  
  const data = await response.json();

  console.log(`[Evolution API] Response status: ${response.status}`);
  console.log(`[Evolution API] Response:`, JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Evolution API error");
  }

  return data;
}

// OPTIONS handler for CORS
app.options("*", (c) => {
  return new Response(null, { headers: corsHeaders });
});

// Create a new instance
app.post("/create-instance", async (c) => {
  try {
    const { instanceName } = await c.req.json();

    if (!instanceName) {
      return c.json({ error: "instanceName is required" }, 400, corsHeaders);
    }

    // Create instance with QR code enabled
    const result = await evolutionRequest("/instance/create", "POST", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error creating instance:", error);
    const message = error instanceof Error ? error.message : "Failed to create instance";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Get QR Code for an instance
app.get("/connect/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(`/instance/connect/${instanceName}`);

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error getting QR code:", error);
    const message = error instanceof Error ? error.message : "Failed to get QR code";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Get connection state
app.get("/connection-state/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/instance/connectionState/${instanceName}`
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error getting connection state:", error);
    const message = error instanceof Error ? error.message : "Failed to get connection state";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Fetch all instances
app.get("/fetch-instances", async (c) => {
  try {
    const result = await evolutionRequest("/instance/fetchInstances");

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error fetching instances:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch instances";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Delete an instance
app.delete("/delete/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/instance/delete/${instanceName}`,
      "DELETE"
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error deleting instance:", error);
    const message = error instanceof Error ? error.message : "Failed to delete instance";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Logout from an instance
app.post("/logout/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/instance/logout/${instanceName}`,
      "DELETE"
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error logging out:", error);
    const message = error instanceof Error ? error.message : "Failed to logout";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
