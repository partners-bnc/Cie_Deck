const recipients = [
  'gurvinder@bncglobal.in',
  'summit@bncglobal.in',
  'anshubncglobal@gmail.com'
];

const dateStr = 'September 14, 2026';
const totalSourced = 18;
const totalShortlisted = 3;
const totalCalls = 27;
const conversionRate = '16.7';

const hrMetrics = [
  { hr_name: 'Shreya Gaba', role: 'HR Specialist', sourced: 11, shortlisted: 3, calls: 11 },
  { hr_name: 'Sunita Singh', role: 'HR Specialist', sourced: 7, shortlisted: 0, calls: 9 },
  { hr_name: 'Shailvi Soni', role: 'HR Specialist', sourced: 0, shortlisted: 0, calls: 7 }
];

const rowsHtml = hrMetrics.map((hr, idx) => {
  const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
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
}).join('');

const htmlContent = `<!DOCTYPE html>
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
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 16px rgba(11, 47, 91, 0.06);">
          
          <!-- CieDeck Banner -->
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

async function testViaEdgeFunction() {
  for (const email of recipients) {
    console.log(`Calling Edge Function send-email for: ${email}`);
    try {
      const res = await fetch('https://bvvqyjqokvnttbgyjkrt.supabase.co/functions/v1/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email,
          subject: `CieDeck Daily Recruitment Report - ${dateStr}`,
          html: htmlContent
        })
      });
      const data = await res.json();
      console.log(`Status for ${email}:`, res.status, data);
    } catch (e) {
      console.error(`Failed for ${email}:`, e);
    }
  }
}

testViaEdgeFunction();
