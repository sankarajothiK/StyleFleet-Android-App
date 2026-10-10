// Extracts salon services and prices from a menu-card photo with Gemini.
// The Gemini key lives only in the GEMINI_API_KEY Supabase secret, never in the app.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PROMPT = `You are an AI assistant that extracts salon service menus into structured JSON.
Look at this salon price list / menu image and extract all service categories, service items, and their prices in Indian Rupees (INR).
Return ONLY a valid JSON object matching this schema:
{ "items": [ { "category": "Hair", "name": "Haircut", "price": 350 } ] }
Do NOT include markdown formatting or backticks. Only output raw JSON.`;

const MODELS = ["gemini-2.5-flash", "gemini-flash-latest"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = (Deno.env.get("GEMINI_API_KEY") || "").trim();
    if (!apiKey) return json({ error: "Menu import is not configured on the server." }, 500);

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json({ error: "No image received." }, 400);
    }

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, response_mime_type: "application/json" },
    });

    let lastError = "Gemini request failed.";
    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = data?.error?.message || lastError;
        continue;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = "No service items identified in the image.";
        continue;
      }
      let parsed: { items?: { category?: string; name?: string; price?: number }[] };
      try {
        parsed = JSON.parse(text);
      } catch {
        lastError = "Could not read the menu. Try a clearer photo.";
        continue;
      }
      const items = (parsed.items || [])
        .filter((i) => i && typeof i.name === "string" && i.name.trim() && Number(i.price) > 0)
        .map((i) => ({
          category: (i.category || "General").toString().trim(),
          name: i.name!.toString().trim(),
          price: Number(i.price),
        }));
      return json({ items });
    }

    return json({ error: lastError }, 502);
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error." }, 500);
  }
});
