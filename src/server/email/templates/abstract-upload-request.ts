/**
 * Email template: Abstract Upload Request
 * Sent to all team members when their team is locked for a Paper Presentation event.
 * Prompts team leader to upload abstract via Google Drive link.
 */

export type AbstractUploadRequestEmailData = {
  memberName: string;
  teamName: string;
  eventName: string;
  abstractDeadline?: string;
  dashboardUrl: string;
  isLeader: boolean;
};

export function buildAbstractUploadRequestEmail(data: AbstractUploadRequestEmailData): string {
  const deadlineBlock = data.abstractDeadline
    ? `<div style="margin:20px 0;padding:16px;background:#1a1a2e;border-radius:8px;border:1px solid #2a2a3a;text-align:center;">
         <p style="margin:0 0 4px;font-size:12px;color:#8888aa;text-transform:uppercase;letter-spacing:0.5px;">Submission Deadline</p>
         <p style="margin:0;font-size:20px;font-weight:700;color:#ff6b6b;">${data.abstractDeadline}</p>
       </div>`
    : '';

  const ctaBlock = data.isLeader
    ? `<a href="${data.dashboardUrl}" 
         style="display:inline-block;margin-top:16px;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Upload Abstract
      </a>
      <p style="margin-top:12px;font-size:13px;color:#aaa;">
        Upload your abstract directly on your dashboard.
      </p>`
    : `<p style="margin-top:16px;font-size:14px;color:#cccccc;background:#1a1a2e;border-radius:8px;padding:16px;border:1px solid #2a2a3a;">
        Your <strong style="color:#fff;">Team Leader</strong> will upload the abstract on behalf of the team.
        Please coordinate with them to ensure timely submission.
      </p>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Submit Your Abstract</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:32px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">

        <!-- Header -->
        <tr><td style="padding:28px 36px 20px;border-bottom:1px solid #2a2a3a;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">📄 Abstract Submission Required</p>
          <p style="margin:6px 0 0;font-size:14px;color:#8888aa;">Your team has been locked — now submit your abstract.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 36px 28px;">
          <p style="margin:0 0 16px;font-size:15px;color:#cccccc;">Dear ${data.memberName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;">
            Your team <strong style="color:#fff;">${data.teamName}</strong> has been successfully locked for
            <strong style="color:#fff;">${data.eventName}</strong>. 
            The next step is to submit your abstract.
          </p>

          <!-- Instructions -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;border:1px solid #2a2a3a;margin-bottom:16px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#8888aa;text-transform:uppercase;letter-spacing:0.5px;">How to Submit</p>
              <ol style="margin:0;padding-left:20px;font-size:13px;color:#aaa;line-height:2;">
                <li>Prepare your abstract document (PDF or Word, max 10MB)</li>
                <li>Go to your team dashboard on the website</li>
                <li>Upload the document directly using the upload portal</li>
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
