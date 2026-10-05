// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This Edge Function safely handles 2Factor OTP without leaking secrets to the Expo mobile app.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, phone, otp, sessionId } = await req.json();
    const apiKey = Deno.env.get("TWO_FACTOR_API_KEY");
    const templateName = Deno.env.get("TWO_FACTOR_TEMPLATE_NAME") || "Login_Verification_OTP";

    if (!apiKey) {
      throw new Error("Server configuration error: TWO_FACTOR_API_KEY not configured");
    }

    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid 10-digit mobile number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: SEND OTP (6-digit code via Login_Verification_OTP template)
    if (action === "send") {
      const url = `https://2factor.in/API/V1/${apiKey}/SMS/${cleanPhone}/AUTOGEN/${templateName}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.Status === "Success") {
        return new Response(
          JSON.stringify({
            success: true,
            sessionId: data.Details,
            message: "6-digit OTP sent successfully",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: data.Details || "Failed to send OTP via SMS provider",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ACTION: VERIFY OTP (6-digit code)
    if (action === "verify") {
      if (!sessionId || !otp || otp.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing sessionId or invalid 6-digit OTP" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const verifyUrl = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;
      const response = await fetch(verifyUrl);
      const data = await response.json();

      if (data.Status === "Success" && data.Details === "OTP Matched") {
        // Authenticate or create user in Supabase Auth via Admin Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        let authData = null;
        if (supabaseUrl && supabaseServiceKey) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
          const fullPhone = `+91${cleanPhone}`;
          
          // Check or create user
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          let user = userList?.users?.find((u) => u.phone === fullPhone);
          
          if (!user) {
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              phone: fullPhone,
              phone_confirm: true,
            });
            if (createError) throw createError;
            user = newUser.user;
          }

          // Generate access token / session
          const { data: sessionData, error: sessionErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: `${cleanPhone}@salon.local`,
          });
          authData = { userId: user.id, phone: fullPhone };
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "OTP verified successfully",
            verified: true,
            auth: authData,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: data.Details || "Invalid or expired OTP",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action requested" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
