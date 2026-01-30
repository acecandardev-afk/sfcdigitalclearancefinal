import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  clearance_request_id: string;
  signatory_ids: string[];
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "SFC-G DCS <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return res.json();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clearance_request_id, signatory_ids }: NotifyRequest = await req.json();

    console.log("Received notification request:", { clearance_request_id, signatory_ids });

    // Fetch clearance request details with student info
    const { data: clearanceRequest, error: requestError } = await supabase
      .from("clearance_requests")
      .select(`
        id,
        title,
        description,
        created_at,
        profiles:student_id (
          full_name,
          email,
          student_id,
          course,
          year_level
        )
      `)
      .eq("id", clearance_request_id)
      .single();

    if (requestError || !clearanceRequest) {
      console.error("Error fetching clearance request:", requestError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch clearance request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Clearance request details:", clearanceRequest);

    // Fetch signatory details
    const { data: signatories, error: signatoriesError } = await supabase
      .from("signatories")
      .select("id, name, email, position, department")
      .in("id", signatory_ids);

    if (signatoriesError || !signatories) {
      console.error("Error fetching signatories:", signatoriesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch signatories" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Signatories to notify:", signatories);

    const student = clearanceRequest.profiles as any;
    const emailResults = [];

    // Send email to each signatory
    for (const signatory of signatories) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
              .label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
              .value { color: #111827; font-size: 16px; margin-bottom: 12px; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📋 New Clearance Request</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your signature is required</p>
              </div>
              <div class="content">
                <p>Dear <strong>${signatory.name}</strong>,</p>
                <p>A student has submitted a clearance request that requires your approval as <strong>${signatory.position}</strong> in the <strong>${signatory.department}</strong> department.</p>
                
                <div class="info-box">
                  <div class="label">Request Title</div>
                  <div class="value">${clearanceRequest.title}</div>
                  
                  <div class="label">Student Name</div>
                  <div class="value">${student?.full_name || 'N/A'}</div>
                  
                  <div class="label">Student ID</div>
                  <div class="value">${student?.student_id || 'N/A'}</div>
                  
                  <div class="label">Course & Year</div>
                  <div class="value">${student?.course || 'N/A'} - ${student?.year_level || 'N/A'}</div>
                  
                  ${clearanceRequest.description ? `
                  <div class="label">Description</div>
                  <div class="value">${clearanceRequest.description}</div>
                  ` : ''}
                  
                  <div class="label">Submitted On</div>
                  <div class="value">${new Date(clearanceRequest.created_at).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
                </div>
                
                <p>Please log in to the SFC-G Digital Clearance System to review and approve or reject this request.</p>
                
                <div class="footer">
                  <p>This is an automated notification from SFC-G Digital Clearance System.<br>Please do not reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        const emailResponse = await sendEmail(
          signatory.email,
          "New Clearance Request - Action Required",
          emailHtml
        );

        console.log(`Email sent to ${signatory.email}:`, emailResponse);
        emailResults.push({ signatory: signatory.email, success: true, response: emailResponse });
      } catch (emailError: any) {
        console.error(`Failed to send email to ${signatory.email}:`, emailError);
        emailResults.push({ signatory: signatory.email, success: false, error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results: emailResults }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-signatories function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
