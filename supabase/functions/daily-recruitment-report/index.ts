import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

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
  screened: number;
}

interface JPCSubmission {
  id: string | number;
  applicant_code: string;
  name: string;
  job_code: string;
  shortlisted_by: string;
  created_at: string;
  current_stage: string;
  manager_submitted_at?: string | null;
  client_submitted_at?: string | null;
  feedback_received_at?: string | null;
}

interface ActiveJPC {
  job_code: string;
  job_title: string;
  client_name?: string | null;
  business_unit?: string | null;
  recruitment_manager?: string | null;
  created_on?: string | null;
  candidates: JPCSubmission[];
}

function formatDateDisplay(dStr?: string | null): string {
  if (!dStr) return "—";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dStr;
  }
}

function getISTDayUTCRange(istDateStr: string): { startUTC: string; endUTC: string } {
  try {
    const [year, month, day] = istDateStr.split("-").map(Number);
    const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);
    const endUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - (5 * 60 + 30) * 60 * 1000);
    return {
      startUTC: startUTC.toISOString(),
      endUTC: endUTC.toISOString(),
    };
  } catch {
    return {
      startUTC: `${istDateStr}T00:00:00.000Z`,
      endUTC: `${istDateStr}T23:59:59.999Z`,
    };
  }
}

async function fetchScreenedApplicantsForDate(supabase: any, istDateStr: string) {
  const { startUTC, endUTC } = getISTDayUTCRange(istDateStr);

  // 1. Scalable Targeted Query: Only fetch candidates updated within target IST day window
  const { data: updatedToday, error: err1 } = await supabase
    .from("applicants")
    .select("applicant_code, screening, updated_on, created_on")
    .not("screening", "is", null)
    .neq("screening", "[]")
    .gte("updated_on", startUTC)
    .lte("updated_on", endUTC);

  if (!err1 && updatedToday && updatedToday.length > 0) {
    return updatedToday;
  }

  // 2. Secondary Fallback Query: Fetch most recent non-empty screening records
  const { data: recentScreened } = await supabase
    .from("applicants")
    .select("applicant_code, screening, updated_on, created_on")
    .not("screening", "is", null)
    .neq("screening", "[]")
    .order("updated_on", { ascending: false, nullsFirst: false })
    .limit(2000);

  return recentScreened || [];
}

function isSameISTDate(isoTimestamp: any, targetISTDateStr: string): boolean {
  if (!isoTimestamp || !targetISTDateStr) return false;
  const str = String(isoTimestamp).trim();
  if (str.startsWith(targetISTDateStr)) return true;

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
      if (istDate === targetISTDateStr) return true;
      const utcDate = d.toISOString().slice(0, 10);
      if (utcDate === targetISTDateStr) return true;
    }
  } catch {}

  return str.includes(targetISTDateStr);
}

function generatePipelineStepperHtml(cand: JPCSubmission): string {
  const stage = (cand.current_stage || "Tagged").toLowerCase();
  
  const isTagged = true;
  const isManagerSubmit = stage.includes("manager") || stage.includes("client") || stage.includes("feedback") || !!cand.manager_submitted_at;
  const isClientSubmit = stage.includes("client") || stage.includes("feedback") || !!cand.client_submitted_at;
  const isFeedback = stage.includes("feedback") || !!cand.feedback_received_at;

  const getCircle = (active: boolean, stepNum: string) => {
    if (active) {
      return `<div style="width: 20px; height: 20px; border-radius: 50%; background-color: #10b981; color: #ffffff; font-size: 11px; line-height: 20px; font-weight: bold; text-align: center; margin: 0 auto 3px auto;">✓</div>`;
    }
    return `<div style="width: 20px; height: 20px; border-radius: 50%; background-color: #f1f5f9; border: 1px solid #cbd5e1; color: #94a3b8; font-size: 10px; line-height: 18px; font-weight: bold; text-align: center; margin: 0 auto 3px auto;">${stepNum}</div>`;
  };

  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 8px; background-color: #f8fafc; border-radius: 8px; padding: 8px 10px; border: 1px solid #e2e8f0;">
      <tr>
        <td align="center" width="25%" style="vertical-align: top;">
          ${getCircle(isTagged, "1")}
          <div style="font-size: 10px; font-weight: 700; color: ${isTagged ? '#065f46' : '#64748b'};">Tagged</div>
        </td>
        <td align="center" width="25%" style="vertical-align: top;">
          ${getCircle(isManagerSubmit, "2")}
          <div style="font-size: 10px; font-weight: ${isManagerSubmit ? '700' : '500'}; color: ${isManagerSubmit ? '#065f46' : '#64748b'};">Manager Submit</div>
        </td>
        <td align="center" width="25%" style="vertical-align: top;">
          ${getCircle(isClientSubmit, "3")}
          <div style="font-size: 10px; font-weight: ${isClientSubmit ? '700' : '500'}; color: ${isClientSubmit ? '#065f46' : '#64748b'};">Client Submit</div>
        </td>
        <td align="center" width="25%" style="vertical-align: top;">
          ${getCircle(isFeedback, "4")}
          <div style="font-size: 10px; font-weight: ${isFeedback ? '700' : '500'}; color: ${isFeedback ? '#065f46' : '#64748b'};">Feedback</div>
        </td>
      </tr>
    </table>
  `;
}

function generateDailyReportHtml(params: {
  dateStr: string;
  totalSourced: number;
  totalShortlisted: number;
  totalCalls: number;
  totalScreened: number;
  hrMetrics: HRMetric[];
  activeJPCs: ActiveJPC[];
}): string {
  const { dateStr, totalSourced, totalShortlisted, totalCalls, totalScreened, hrMetrics, activeJPCs } = params;

  const conversionRate = totalSourced > 0
    ? ((totalShortlisted / totalSourced) * 100).toFixed(1)
    : "0.0";

  // HR Breakdown Table Rows
  const hrRowsHtml = hrMetrics.length > 0
    ? hrMetrics.map((hr, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        return `
          <tr style="background-color: ${bg}; border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 14px; font-size: 13px; color: #111827; font-weight: 600;">
              ${hr.hr_name}
              <div style="font-size: 11px; color: #6b7280; font-weight: normal;">${hr.role}</div>
            </td>
            <td align="center" style="padding: 12px 10px; font-size: 13px; color: #0b2f5b; font-weight: 700;">${hr.sourced}</td>
            <td align="center" style="padding: 12px 10px; font-size: 13px; color: #15803d; font-weight: 700;">${hr.shortlisted}</td>
            <td align="center" style="padding: 12px 10px; font-size: 13px; color: #4338ca; font-weight: 700;">${hr.calls}</td>
            <td align="center" style="padding: 12px 10px; font-size: 13px; color: #0891b2; font-weight: 700;">${hr.screened}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="5" align="center" style="padding: 20px; font-size: 13px; color: #6b7280;">No recruitment activity logged for today.</td></tr>`;

  // Active Client JPCs & Pipeline Section
  const jpcSectionsHtml = activeJPCs.length > 0
    ? activeJPCs.map((jpc) => {
        const candidatesHtml = jpc.candidates.length > 0
          ? jpc.candidates.map((cand) => `
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <span style="font-size: 13px; font-weight: 700; color: #1e293b;">${cand.name || 'Candidate'}</span>
                      <span style="font-size: 11px; font-weight: 600; color: #64748b; background-color: #f1f5f9; padding: 2px 6px; border-radius: 6px; margin-left: 6px;">#${cand.applicant_code || cand.id}</span>
                    </td>
                    <td align="right">
                      <span style="font-size: 11px; color: #64748b;">Tagged by <strong>${cand.shortlisted_by || 'HR'}</strong> on ${formatDateDisplay(cand.created_at)}</span>
                    </td>
                  </tr>
                </table>
                ${generatePipelineStepperHtml(cand)}
              </div>
            `).join("")
          : `<div style="padding: 12px 14px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; text-align: center; font-size: 12px; color: #94a3b8;">No candidates submitted in pipeline yet for this JPC.</div>`;

        return `
          <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; margin-bottom: 18px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <!-- JPC Header Card -->
            <div style="background-color: #f8fafc; padding: 14px 18px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #0b2f5b; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.3px;">
                      ${jpc.job_code}
                    </span>
                    <span style="display: inline-block; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px; margin-left: 6px;">
                      ACTIVE
                    </span>
                    <h4 style="margin: 6px 0 2px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                      ${jpc.job_title}
                    </h4>
                    <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
                      Client: <strong style="color: #334155;">${jpc.client_name || jpc.business_unit || 'Direct Client'}</strong> &bull; Manager: <strong>${jpc.recruitment_manager || 'Not Assigned'}</strong>
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">
                      ${jpc.candidates.length} Candidate${jpc.candidates.length === 1 ? '' : 's'}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- JPC Submissions / Pipeline List -->
            <div style="padding: 14px 18px; background-color: #fafafa;">
              <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.4px;">
                Pipeline Submissions (${jpc.candidates.length})
              </div>
              ${candidatesHtml}
            </div>
          </div>
        `;
      }).join("")
    : `<div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; background-color: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">No Active JPCs found at this time.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Recruitment Activity Report - ${dateStr}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f2ed; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1f2937;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f7f2ed; padding: 28px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 16px rgba(11, 47, 91, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b2f5b 0%, #1a4a8a 100%); padding: 30px 32px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.3px;">CieDeck</h1>
                    <p style="margin: 4px 0 0 0; color: #c5d5ea; font-size: 13px; font-weight: 500;">Talent Acquisition & Recruitment Team</p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                      Daily Activity Report
                    </span>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; font-size: 13px;">
                Report Date: <strong style="color: #ffffff;">${dateStr}</strong>
              </div>
            </td>
          </tr>

          <!-- Summary Metric Cards (4 Cards) -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <h3 style="margin: 0 0 14px 0; color: #0b2f5b; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Executive Summary
              </h3>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Sourced -->
                  <td width="23%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 10px; text-align: center;">
                    <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Sourced</div>
                    <div style="color: #0b2f5b; font-size: 24px; font-weight: 800; line-height: 1;">${totalSourced}</div>
                    <div style="color: #2563eb; font-size: 10px; font-weight: 600; margin-top: 4px;">Today's Inflow</div>
                  </td>
                  <td width="2.6%">&nbsp;</td>
                  <!-- Shortlisted -->
                  <td width="23%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 10px; text-align: center;">
                    <div style="color: #166534; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Shortlisted</div>
                    <div style="color: #15803d; font-size: 24px; font-weight: 800; line-height: 1;">${totalShortlisted}</div>
                    <div style="color: #16a34a; font-size: 10px; font-weight: 600; margin-top: 4px;">${conversionRate}% Conv.</div>
                  </td>
                  <td width="2.6%">&nbsp;</td>
                  <!-- Calls -->
                  <td width="23%" style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 14px 10px; text-align: center;">
                    <div style="color: #4338ca; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Calls</div>
                    <div style="color: #3730a3; font-size: 24px; font-weight: 800; line-height: 1;">${totalCalls}</div>
                    <div style="color: #6366f1; font-size: 10px; font-weight: 600; margin-top: 4px;">Outreach</div>
                  </td>
                  <td width="2.6%">&nbsp;</td>
                  <!-- Screened -->
                  <td width="23%" style="background-color: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 14px 10px; text-align: center;">
                    <div style="color: #0e7490; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Screened</div>
                    <div style="color: #0891b2; font-size: 24px; font-weight: 800; line-height: 1;">${totalScreened}</div>
                    <div style="color: #06b6d4; font-size: 10px; font-weight: 600; margin-top: 4px;">Verified CVs</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HR Breakdown Table -->
          <tr>
            <td style="padding: 14px 28px 20px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
                <tr>
                  <td>
                    <h3 style="margin: 0; color: #0b2f5b; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      HR Performance Breakdown
                    </h3>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #0b2f5b; color: #ffffff;">
                    <th align="left" style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">HR / Recruiter</th>
                    <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">Sourced</th>
                    <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">Shortlisted</th>
                    <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">Calls</th>
                    <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">Screened</th>
                  </tr>
                </thead>
                <tbody>
                  ${hrRowsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f1f5f9; border-top: 2px solid #cbd5e1;">
                    <td style="padding: 12px 12px; font-size: 12px; font-weight: 800; color: #0b2f5b; text-transform: uppercase;">
                      Total Aggregated
                    </td>
                    <td align="center" style="padding: 12px 8px; font-size: 14px; font-weight: 800; color: #0b2f5b;">
                      ${totalSourced}
                    </td>
                    <td align="center" style="padding: 12px 8px; font-size: 14px; font-weight: 800; color: #15803d;">
                      ${totalShortlisted}
                    </td>
                    <td align="center" style="padding: 12px 8px; font-size: 14px; font-weight: 800; color: #4338ca;">
                      ${totalCalls}
                    </td>
                    <td align="center" style="padding: 12px 8px; font-size: 14px; font-weight: 800; color: #0891b2;">
                      ${totalScreened}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Active Client JPCs & Candidate Pipeline Flow Section -->
          <tr>
            <td style="padding: 14px 28px 24px 28px; border-top: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 4px 0; color: #0b2f5b; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      Active Client JPCs & Candidate Pipeline Flow
                    </h3>
                    <p style="margin: 0; font-size: 12px; color: #64748b;">
                      Currently active job postings and candidate progress across recruitment stages.
                    </p>
                  </td>
                </tr>
              </table>

              ${jpcSectionsHtml}
            </td>
          </tr>

          <!-- Footer Information -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 28px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
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

    // 2. Fetch daily stats, active admins, screenings, and active JPCs in parallel
    const [statsRes, adminsRes, applicantsScreeningData, clientJobsRes] = await Promise.all([
      supabase
        .from("dashboard_hr_daily_stats")
        .select("hr_name, uploaded_count, tagged_count, calls_count")
        .eq("stat_date", istDateStr),
      supabase
        .from("admin_users")
        .select("hr_name, role, designation, is_active")
        .eq("is_active", true),
      fetchScreenedApplicantsForDate(supabase, istDateStr),
      supabase
        .from("client_jobs")
        .select("job_code, job_title, client_name, business_unit, recruitment_manager, created_on, status")
        .ilike("status", "%active%")
        .order("created_on", { ascending: false }),
    ]);

    const statsData = statsRes.data || [];
    const adminsData = adminsRes.data || [];
    const rawClientJobs = clientJobsRes.data || [];

    console.log(`Fetched ${statsData.length} stats rows, ${adminsData.length} admins, ${applicantsScreeningData.length} screening rows, ${rawClientJobs.length} active jobs`);

    // Filter active jobs, excluding hold or closed
    const activeJPCs = rawClientJobs.filter((j: any) => {
      const s = (j.status || "").toLowerCase();
      return s.includes("active") && !s.includes("hold") && !s.includes("close");
    });

    // 3. Calculate HR Screening counts for today using flexible IST/UTC date matching & name normalization
    const hrScreeningCounts = new Map<string, number>();
    const originalHrNameMap = new Map<string, string>();
    let totalScreenedCount = 0;

    applicantsScreeningData.forEach((row: any) => {
      let screeningList: any[] = [];
      if (Array.isArray(row.screening)) {
        screeningList = row.screening;
      } else if (typeof row.screening === "string") {
        try {
          const parsed = JSON.parse(row.screening);
          if (Array.isArray(parsed)) screeningList = parsed;
          else if (parsed && typeof parsed === "object") screeningList = [parsed];
        } catch {}
      }

      screeningList.forEach((s: any) => {
        if (!s) return;
        const hrRaw = (s.hr_name || s.hrName || s.name || s.admin_name || s.shortlisted_by || "HR Admin").trim();
        const timestamp = s.screened_at || s.screenedAt || s.date || s.created_at || row.updated_on;

        if (timestamp && isSameISTDate(timestamp, istDateStr)) {
          const normHr = hrRaw.toLowerCase();
          if (!originalHrNameMap.has(normHr)) {
            originalHrNameMap.set(normHr, hrRaw);
          }
          hrScreeningCounts.set(normHr, (hrScreeningCounts.get(normHr) || 0) + 1);
          totalScreenedCount++;
        }
      });
    });

    console.log("HR Screening Counts calculated:", Array.from(hrScreeningCounts.entries()), "Total Screened:", totalScreenedCount);

    const getScreenedCountForHr = (name: string): number => {
      const norm = (name || "").trim().toLowerCase();
      return hrScreeningCounts.get(norm) || 0;
    };

    // 4. Map active admin roles
    const adminRoleMap = new Map<string, string>();
    adminsData.forEach((a: any) => {
      adminRoleMap.set(
        (a.hr_name || "").trim().toLowerCase(),
        a.designation || (a.role === "super_admin" ? "Super Admin" : "HR Specialist")
      );
    });

    const hrMetricsMap = new Map<string, HRMetric>();

    // Seed active admins so they appear in report even if 0 activity
    adminsData.forEach((admin: any) => {
      const rawName = (admin.hr_name || "").trim();
      const norm = rawName.toLowerCase();
      if (!norm) return;

      hrMetricsMap.set(norm, {
        hr_name: rawName,
        role: admin.designation || (admin.role === "super_admin" ? "Super Admin" : "HR Specialist"),
        sourced: 0,
        shortlisted: 0,
        calls: 0,
        screened: getScreenedCountForHr(rawName),
      });
    });

    // Populate daily stats from dashboard_hr_daily_stats
    statsData.forEach((row: any) => {
      const rawName = (row.hr_name || "Portal / Unknown").trim();
      const norm = rawName.toLowerCase();
      const screened = getScreenedCountForHr(rawName);
      const existing = hrMetricsMap.get(norm);
      if (existing) {
        existing.sourced += row.uploaded_count || 0;
        existing.shortlisted += row.tagged_count || 0;
        existing.calls += row.calls_count || 0;
        if (existing.screened === 0 && screened > 0) {
          existing.screened = screened;
        }
      } else {
        hrMetricsMap.set(norm, {
          hr_name: rawName,
          role: adminRoleMap.get(norm) || "Recruiter",
          sourced: row.uploaded_count || 0,
          shortlisted: row.tagged_count || 0,
          calls: row.calls_count || 0,
          screened,
        });
      }
    });

    // Also include any HR who screened candidates today but wasn't in admin list
    hrScreeningCounts.forEach((count, normHr) => {
      const existing = hrMetricsMap.get(normHr);
      if (existing) {
        existing.screened = count;
      } else {
        const displayName = originalHrNameMap.get(normHr) || normHr;
        hrMetricsMap.set(normHr, {
          hr_name: displayName,
          role: adminRoleMap.get(normHr) || "Recruiter",
          sourced: 0,
          shortlisted: 0,
          calls: 0,
          screened: count,
        });
      }
    });

    const hrMetrics = Array.from(hrMetricsMap.values()).sort((a, b) => b.sourced - a.sourced || b.screened - a.screened);

    const totalSourced = hrMetrics.reduce((sum, item) => sum + item.sourced, 0);
    const totalShortlisted = hrMetrics.reduce((sum, item) => sum + item.shortlisted, 0);
    const totalCalls = hrMetrics.reduce((sum, item) => sum + item.calls, 0);

    // 5. Fetch pipeline candidate submissions for all active JPCs
    const activeJobCodes = activeJPCs.map((j: any) => j.job_code).filter(Boolean);
    let activeJPCsWithCandidates: ActiveJPC[] = [];

    if (activeJobCodes.length > 0) {
      const { data: taggedData } = await supabase
        .from("tagged_candidates")
        .select("id, applicant_code, name, job_code, shortlisted_by, created_at, current_stage, manager_submitted_at, client_submitted_at, feedback_received_at")
        .in("job_code", activeJobCodes)
        .order("created_at", { ascending: false });

      const taggedMap = new Map<string, JPCSubmission[]>();
      (taggedData || []).forEach((item: any) => {
        const jCode = item.job_code;
        if (!taggedMap.has(jCode)) taggedMap.set(jCode, []);
        taggedMap.get(jCode)!.push(item);
      });

      activeJPCsWithCandidates = activeJPCs.map((jpc: any) => ({
        job_code: jpc.job_code,
        job_title: jpc.job_title,
        client_name: jpc.client_name,
        business_unit: jpc.business_unit,
        recruitment_manager: jpc.recruitment_manager,
        created_on: jpc.created_on,
        candidates: taggedMap.get(jpc.job_code) || [],
      }));
    } else {
      activeJPCsWithCandidates = activeJPCs.map((jpc: any) => ({
        job_code: jpc.job_code,
        job_title: jpc.job_title,
        client_name: jpc.client_name,
        business_unit: jpc.business_unit,
        recruitment_manager: jpc.recruitment_manager,
        created_on: jpc.created_on,
        candidates: [],
      }));
    }

    const htmlContent = generateDailyReportHtml({
      dateStr: displayDateStr,
      totalSourced,
      totalShortlisted,
      totalCalls,
      totalScreened: totalScreenedCount,
      hrMetrics,
      activeJPCs: activeJPCsWithCandidates,
    });

    // 6. Send emails via ZeptoMail API
    const zohoToken = Deno.env.get("ZOHO_TOKEN")?.trim();
    if (!zohoToken) throw new Error("ZOHO_TOKEN is not configured");
    const authorization = /^Zoho-enczapikey\s/i.test(zohoToken) ? zohoToken : `Zoho-enczapikey ${zohoToken}`;
    const sendResults = [];
    for (const to of recipients) {
      const emailPayload = {
        from: { name: "CieDeck Recruitment Team", address: "partners@bncglobal.in" },
        to: [{ email_address: { address: to } }],
        subject: `CieDeck Daily Recruitment Report - ${displayDateStr}`,
        htmlbody: htmlContent,
      };

      try {
        const zeptoRes = await fetch("https://api.zeptomail.in/v1.1/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": authorization,
          },
          body: JSON.stringify(emailPayload),
        });

        const responseText = await zeptoRes.text();
        let zeptoData: any = {};
        try { zeptoData = responseText ? JSON.parse(responseText) : {}; } catch { zeptoData = { raw: responseText.slice(0, 1000) }; }
        sendResults.push({
          recipient: to,
          status: zeptoRes.status,
          ok: zeptoRes.ok,
          data: zeptoData,
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
          screened: totalScreenedCount,
        },
        hrCount: hrMetrics.length,
        activeJPCCount: activeJPCsWithCandidates.length,
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
