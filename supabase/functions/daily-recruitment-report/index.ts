import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";

const DEFAULT_RECIPIENTS = [
  "gurvinder@bncglobal.in",
  "summit@bncglobal.in",
  "anshubncglobal@gmail.com",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface HRMetric {
  hr_name: string;
  role: string;
  sourced: number;
  shortlisted: number;
  calls: number;
}

function generateDailyReportHtml(params: {
  dateStr: string;
  totalSourced: number;
  totalShortlisted: number;
  totalCalls: number;
  hrMetrics: HRMetric[];
}): string {
  const { dateStr, totalSourced, totalShortlisted, totalCalls, hrMetrics } = params;

  const conversionRate = totalSourced > 0
    ? ((totalShortlisted / totalSourced) * 100).toFixed(1)
    : "0.0";

  const rowsHtml = hrMetrics.length > 0
    ? hrMetrics.map((hr, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        return `
          <tr style="background-color: ${bg}; border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 14px; font-size: 14px; color: #111827; font-weight: 600;">
              ${hr.hr_name}
              <div style="font-size: 11px; color: #6b7280; font-weight: normal;">${hr.role}</div>
            </td>
            <td align="center" style="padding: 12px 10px; font-size: 14px; color: #0b2f5b; font-weight: 700;">${hr.sourced}</td>
            <td align="center" style="padding: 12px 10px; font-size: 14px; color: #15803d; font-weight: 700;">${hr.shortlisted}</td>
            <td align="center" style="padding: 12px 10px; font-size: 14px; color: #4338ca; font-weight: 700;">${hr.calls}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="4" align="center" style="padding: 24px; font-size: 13px; color: #6b7280;">No recruitment activity logged for today.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Recruitment Activity Report - ${dateStr}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f2ed; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1f2937;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f7f2ed; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 16px rgba(11, 47, 91, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b2f5b 0%, #1a4a8a 100%); padding: 32px 36px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">CieDeck</h1>
                    <p style="margin: 4px 0 0 0; color: #c5d5ea; font-size: 14px; font-weight: 500;">Talent Acquisition & Recruitment Team</p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                      Daily Activity Report
                    </span>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; font-size: 13px;">
                Report Date: <strong style="color: #ffffff;">${dateStr}</strong>
              </div>
            </td>
          </tr>

          <!-- Summary Metric Cards -->
          <tr>
            <td style="padding: 28px 32px 12px 32px;">
              <h3 style="margin: 0 0 16px 0; color: #0b2f5b; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Executive Summary
              </h3>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="31%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Applicants Sourced</div>
                    <div style="color: #0b2f5b; font-size: 26px; font-weight: 800; line-height: 1;">${totalSourced}</div>
                    <div style="color: #2563eb; font-size: 11px; font-weight: 600; margin-top: 6px;">Today's Inflow</div>
                  </td>
                  <td width="3.5%">&nbsp;</td>
                  <td width="31%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="color: #166534; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Shortlisted (Tagged)</div>
                    <div style="color: #15803d; font-size: 26px; font-weight: 800; line-height: 1;">${totalShortlisted}</div>
                    <div style="color: #16a34a; font-size: 11px; font-weight: 600; margin-top: 6px;">${conversionRate}% Conversion</div>
                  </td>
                  <td width="3.5%">&nbsp;</td>
                  <td width="31%" style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="color: #4338ca; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Calls Logged</div>
                    <div style="color: #3730a3; font-size: 26px; font-weight: 800; line-height: 1;">${totalCalls}</div>
                    <div style="color: #6366f1; font-size: 11px; font-weight: 600; margin-top: 6px;">Candidate Outreach</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HR Breakdown Table -->
          <tr>
            <td style="padding: 16px 32px 28px 32px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td>
                    <h3 style="margin: 0; color: #0b2f5b; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      HR Performance Breakdown
                    </h3>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #0b2f5b; color: #ffffff;">
                    <th align="left" style="padding: 12px 14px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">HR / Recruiter</th>
                    <th align="center" style="padding: 12px 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Sourced</th>
                    <th align="center" style="padding: 12px 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Shortlisted</th>
                    <th align="center" style="padding: 12px 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Calls Logged</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f1f5f9; border-top: 2px solid #cbd5e1;">
                    <td style="padding: 14px 14px; font-size: 13px; font-weight: 800; color: #0b2f5b; text-transform: uppercase;">
                      Total Aggregated
                    </td>
                    <td align="center" style="padding: 14px 10px; font-size: 15px; font-weight: 800; color: #0b2f5b;">
                      ${totalSourced}
                    </td>
                    <td align="center" style="padding: 14px 10px; font-size: 15px; font-weight: 800; color: #15803d;">
                      ${totalShortlisted}
                    </td>
                    <td align="center" style="padding: 14px 10px; font-size: 15px; font-weight: 800; color: #4338ca;">
                      ${totalCalls}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Footer Information -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                This automated summary was generated by the <strong>CieDeck Portal</strong>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                © CieDeck. Confidential & For Internal Management Review Only.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let reqData: any = {};
    if (req.method === "POST") {
      reqData = await req.json().catch(() => ({}));
    }

    const now = new Date();
    // Default target date in Asia/Kolkata timezone (YYYY-MM-DD)
    const istDateStr = reqData.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    const displayDateStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(now);

    const recipients: string[] = Array.isArray(reqData.recipients) && reqData.recipients.length > 0
      ? reqData.recipients
      : DEFAULT_RECIPIENTS;

    console.log(`Generating daily report for date: ${istDateStr} to:`, recipients);

    // Initialize Supabase Client using service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Refresh aggregates to make sure today's metrics are fresh
    try {
      await supabase.rpc("refresh_dashboard_aggregates");
    } catch (rpcErr) {
      console.warn("Aggregate refresh warning:", rpcErr);
    }

    // 2. Fetch daily stats for the given date
    const [statsRes, adminsRes] = await Promise.all([
      supabase
        .from("dashboard_hr_daily_stats")
        .select("hr_name, uploaded_count, tagged_count, calls_count")
        .eq("stat_date", istDateStr),
      supabase
        .from("admin_users")
        .select("hr_name, role, designation, is_active")
        .eq("is_active", true),
    ]);

    const statsData = statsRes.data || [];
    const adminsData = adminsRes.data || [];

    const adminRoleMap = new Map<string, string>();
    adminsData.forEach((a: any) => {
      adminRoleMap.set(
        a.hr_name,
        a.designation || (a.role === "super_admin" ? "Super Admin" : "HR Specialist")
      );
    });

    const hrMetricsMap = new Map<string, HRMetric>();

    // Seed active admins so they appear in report even if 0 activity
    adminsData.forEach((admin: any) => {
      hrMetricsMap.set(admin.hr_name, {
        hr_name: admin.hr_name,
        role: admin.designation || (admin.role === "super_admin" ? "Super Admin" : "HR Specialist"),
        sourced: 0,
        shortlisted: 0,
        calls: 0,
      });
    });

    // Populate daily stats
    statsData.forEach((row: any) => {
      const name = row.hr_name || "Portal / Unknown";
      const existing = hrMetricsMap.get(name);
      if (existing) {
        existing.sourced += row.uploaded_count || 0;
        existing.shortlisted += row.tagged_count || 0;
        existing.calls += row.calls_count || 0;
      } else {
        hrMetricsMap.set(name, {
          hr_name: name,
          role: adminRoleMap.get(name) || "Recruiter",
          sourced: row.uploaded_count || 0,
          shortlisted: row.tagged_count || 0,
          calls: row.calls_count || 0,
        });
      }
    });

    const hrMetrics = Array.from(hrMetricsMap.values()).sort((a, b) => b.sourced - a.sourced);

    const totalSourced = hrMetrics.reduce((sum, item) => sum + item.sourced, 0);
    const totalShortlisted = hrMetrics.reduce((sum, item) => sum + item.shortlisted, 0);
    const totalCalls = hrMetrics.reduce((sum, item) => sum + item.calls, 0);

    const htmlContent = generateDailyReportHtml({
      dateStr: displayDateStr,
      totalSourced,
      totalShortlisted,
      totalCalls,
      hrMetrics,
    });

    // Send emails via Brevo API
    const sendResults = [];
    for (const to of recipients) {
      const emailPayload = {
        sender: { name: "CieDeck Recruitment Team", email: "partners@bncglobal.in" },
        to: [{ email: to }],
        subject: `CieDeck Daily Recruitment Report - ${displayDateStr}`,
        htmlContent,
      };

      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY,
          },
          body: JSON.stringify(emailPayload),
        });

        const brevoData = await brevoRes.json().catch(() => ({}));
        sendResults.push({
          recipient: to,
          status: brevoRes.status,
          ok: brevoRes.ok,
          data: brevoData,
        });
      } catch (err: any) {
        sendResults.push({
          recipient: to,
          status: 500,
          ok: false,
          error: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: istDateStr,
        totals: {
          sourced: totalSourced,
          shortlisted: totalShortlisted,
          calls: totalCalls,
        },
        hrCount: hrMetrics.length,
        sendResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Daily report function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
