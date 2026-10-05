// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This Edge Function safely handles Cashfree payments without leaking secret keys to the client.

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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action } = body;

    const appId = Deno.env.get("CASHFREE_APP_ID") || "";
    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    const env = (Deno.env.get("CASHFREE_ENVIRONMENT") || "PRODUCTION").toUpperCase();

    const baseUrl = env === "PRODUCTION"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

    const cashfreeHeaders = {
      "x-api-version": "2023-08-01",
      "x-client-id": appId,
      "x-client-secret": secretKey,
      "Content-Type": "application/json",
    };

    // ACTION 1: CREATE ORDER
    if (action === "create-order") {
      const { shopId, planId, amount, customerName, customerPhone, customerEmail } = body;

      if (!amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid order amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanPhone = (customerPhone || "9999999999").replace(/\D/g, "").slice(-10);
      const safeOrderId = `sf_${(shopId || "shop").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}_${Date.now()}`;

      const payload = {
        order_id: safeOrderId,
        order_amount: Number(amount),
        order_currency: "INR",
        customer_details: {
          customer_id: `cust_${(shopId || "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`,
          customer_name: customerName || "Salon Owner",
          customer_phone: cleanPhone,
          customer_email: customerEmail || "owner@stylefleet.app",
        },
        order_meta: {
          return_url: `stylefleet://payment-callback?order_id=${safeOrderId}`,
        },
        order_note: `StyleFleet Plan: ${planId}`,
      };

      // Call Cashfree API
      const response = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: cashfreeHeaders,
        body: JSON.stringify(payload),
      });

      const orderData = await response.json();

      if (!response.ok || !orderData.payment_session_id) {
        return new Response(
          JSON.stringify({
            error: orderData.message || "Failed to create Cashfree order",
            details: orderData,
          }),
          { status: response.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          orderId: safeOrderId,
          cfOrderId: orderData.cf_order_id,
          paymentSessionId: orderData.payment_session_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION 2: VERIFY ORDER & ACTIVATE SUBSCRIPTION
    if (action === "verify-order") {
      const { orderId, shopId, planId } = body;

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Missing orderId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${baseUrl}/orders/${orderId}`, {
        method: "GET",
        headers: cashfreeHeaders,
      });

      const orderData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: orderData.message || "Failed to fetch order from Cashfree" }),
          { status: response.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isPaid = orderData.order_status === "PAID";

      if (isPaid && shopId) {
        // Calculate duration based on planId
        const planDurations: Record<string, number> = {
          "1_month": 30,
          "3_months": 90,
          "6_months": 180,
          "12_months": 365,
        };
        const durationDays = planDurations[planId] || 30;

        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + durationDays * 86400000);

        // Update or insert into subscriptions table
        const { data: subData, error: subError } = await supabaseClient
          .from("subscriptions")
          .insert({
            shop_id: shopId,
            plan_id: planId,
            status: "active",
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            cashfree_order_id: orderId,
            cashfree_payment_id: orderData.cf_order_id?.toString() || null,
            amount_minor: Math.round((orderData.order_amount || 0) * 100),
            currency: orderData.order_currency || "INR",
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            status: "PAID",
            subscription: subData,
            message: "Subscription activated successfully!",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: isPaid,
          status: orderData.order_status,
          message: isPaid ? "Payment successful" : "Payment pending or failed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
