/**
 * Email template: Paper Selection Result
 * Sent to all team members when admin publishes selection results.
 * Two variants: SELECTED (with presentation submission CTA) and REJECTED.
 */

export type PaperSelectionResultEmailData = {
  memberName: string;
  teamName: string;
  eventName: string;
  selectionStatus: 'SELECTED' | 'REJECTED';
  selectionNote?: string;
  presentationDeadline?: string;
  dashboardUrl: string;
  isLeader: boolean;
};

export function buildPaperSelectionResultEmail(data: PaperSelectionResultEmailData): string {
  if (data.selectionStatus === 'SELECTED') {
    return buildSelectedEmail(data);
  }
  return buildRejectedEmail(data);
}

function buildSelectedEmail(data: PaperSelectionResultEmailData): string {
  const deadlineBlock = data.presentationDeadline
    ? `<div style="margin:20px 0;padding:16px;background:#0f3d2e;border-radius:8px;border:1px solid #1a5c42;text-align:center;">
         <p style="margin:0 0 4px;font-size:12px;color:#a0c8b8;text-transform:uppercase;letter-spacing:0.5px;">Presentation Deadline</p>
         <p style="margin:0;font-size:20px;font-weight:700;color:#4ade80;">${data.presentationDeadline}</p>
       </div>`
    : '';

  const ctaBlock = data.isLeader
    ? `<a href="${data.dashboardUrl}" 
         style="display:inline-block;margin-top:16px;padding:12px 32px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Upload Presentation
      </a>
      <p style="margin-top:12px;font-size:13px;color:#aaa;">
        Upload your presentation directly on your dashboard.
      </p>`
    : `<p style="margin-top:16px;font-size:14px;color:#cccccc;background:#1a1a2e;border-radius:8px;padding:16px;border:1px solid #2a2a3a;">
        Your <strong style="color:#fff;">Team Leader</strong> will upload the presentation file.
        Please coordinate with your team.
      </p>`;

  const noteBlock = data.selectionNote
    ? `<div style="margin:16px 0;padding:12px 16px;background:#1a1a2e;border-radius:8px;border-left:3px solid #4ade80;">
         <p style="margin:0;font-size:13px;color:#888;">Note from reviewers:</p>
         <p style="margin:6px 0 0;font-size:14px;color:#ccc;">${data.selectionNote}</p>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abstract Selected!</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:32px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">

        <!-- Header -->
        <tr><td style="padding:28px 36px 20px;border-bottom:1px solid #2a2a3a;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">🎉 Congratulations! Abstract Selected</p>
          <p style="margin:6px 0 0;font-size:14px;color:#4ade80;">Your abstract has been selected for presentation.</p>
        </td></tr>

        <!-- Badge -->
        <tr><td style="padding:20px 36px 0;">
          <span style="display:inline-block;padding:4px 14px;border-radius:20px;background:#0f3d2e;border:1px solid #1a5c42;font-size:12px;font-weight:600;color:#4ade80;">SELECTED ✓</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:20px 36px 28px;">
          <p style="margin:0 0 16px;font-size:15px;color:#cccccc;">Dear ${data.memberName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;">
            We are pleased to inform you that your team <strong style="color:#fff;">${data.teamName}</strong>'s
            abstract for <strong style="color:#fff;">${data.eventName}</strong> has been 
            <strong style="color:#4ade80;">selected</strong>!
          </p>

          ${noteBlock}

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;border:1px solid #2a2a3a;margin-bottom:16px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#8888aa;text-transform:uppercase;letter-spacing:0.5px;">Next Steps</p>
              <ol style="margin:0;padding-left:20px;font-size:13px;color:#aaa;line-height:2;">
                <li>Prepare your full presentation (PDF or PowerPoint, max 30MB)</li>
                <li>Go to your team dashboard on the website</li>
                <li>Upload the document directly using the upload portal before the deadline</li>
              </ol>
            </td></tr>
          </table>

          ${deadlineBlock}

          <div style="text-align:center;">
            ${ctaBlock}
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 36px;border-top:1px solid #2a2a3a;text-align:center;">
          <p style="margin:0;font-size:12px;color:#555;">— Team Titanium &nbsp;·&nbsp; Rajalakshmi Engineering College</p>
          <p style="margin:4px 0 0;font-size:11px;color:#444;">This is an automated email. Please do not reply.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildRejectedEmail(data: PaperSelectionResultEmailData): string {
  const noteBlock = data.selectionNote
    ? `<div style="margin:16px 0;padding:12px 16px;background:#1a1a2e;border-radius:8px;border-left:3px solid #f87171;">
         <p style="margin:0;font-size:13px;color:#888;">Feedback from reviewers:</p>
         <p style="margin:6px 0 0;font-size:14px;color:#ccc;">${data.selectionNote}</p>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abstract Review Result</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:32px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">

        <!-- Header -->
        <tr><td style="padding:28px 36px 20px;border-bottom:1px solid #2a2a3a;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Abstract Review Result</p>
          <p style="margin:6px 0 0;font-size:14px;color:#8888aa;">Thank you for your submission.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 36px 28px;">
          <p style="margin:0 0 16px;font-size:15px;color:#cccccc;">Dear ${data.memberName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;">
            Thank you for submitting your abstract for <strong style="color:#fff;">${data.eventName}</strong>
            on behalf of team <strong style="color:#fff;">${data.teamName}</strong>.
          </p>
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;">
            After careful review, we regret to inform you that your abstract was 
            <strong style="color:#f87171;">not selected</strong> for presentation this time.
          </p>

          ${noteBlock}

          <p style="margin:20px 0 0;font-size:14px;color:#cccccc;">
            We appreciate your effort and encourage you to participate in other events. 
            Keep up the great work!
          </p>

          <div style="text-align:center;margin-top:20px;">
            <a href="${data.dashboardUrl}" 
               style="display:inline-block;padding:12px 32px;background:#333;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
              View Dashboard
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 36px;border-top:1px solid #2a2a3a;text-align:center;">
          <p style="margin:0;font-size:12px;color:#555;">— Team Titanium &nbsp;·&nbsp; Rajalakshmi Engineering College</p>
          <p style="margin:4px 0 0;font-size:11px;color:#444;">This is an automated email. Please do not reply.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
