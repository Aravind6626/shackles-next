/**
 * Email Service using Resend
 * Abstracts email sending with pre-built templates for:
 * - Payment verification
 * - Team creation
 * - Team locking
 * - Individual event registration
 */

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using Resend
 * Requires RESEND_API_KEY environment variable
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "noreply@shackles.com",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Resend API error:", error);
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true };
  } catch (err) {
    console.error("Email sending failed:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send payment verification email
 */
export async function sendPaymentVerificationEmail(input: {
  userEmail: string;
  userName: string;
  packageType: string;
  qrCodeUrl?: string;
  eventYear: number;
}): Promise<{ success: boolean; error?: string }> {
  const packageLabel = {
    EVENT_ONLY: "Event Only",
    WORKSHOP_ONLY: "Workshop Only",
    COMBO: "Combo (Events & Workshops)",
  }[input.packageType] || input.packageType;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Shackles Pass Confirmed</h2>
      <p>Hi ${input.userName},</p>
      <p>Your payment has been verified and your symposium pass is ready!</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <strong>Pass Details:</strong>
        <ul>
          <li>Package Type: <strong>${packageLabel}</strong></li>
          <li>Year: <strong>${input.eventYear}</strong></li>
        </ul>
      </div>

      ${
        input.qrCodeUrl
          ? `
        <div style="text-align: center; margin: 20px 0;">
          <p><strong>Your Personal QR Code:</strong></p>
          <img src="${input.qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px;" />
          <p style="font-size: 12px; color: #666;">Use this QR at all stations for kit, attendance, and resource access.</p>
        </div>
      `
          : ""
      }

      <h3>Next Steps:</h3>
      <ol>
        <li>Register for events from the event details page</li>
        <li>Create or join a team if event requires teams</li>
        <li>Bring your ID and this pass QR code to the event</li>
      </ol>

      <p style="font-size: 12px; color: #666; margin-top: 30px;">
        If you have any questions, contact us at support@shackles.com
      </p>
    </div>
  `;

  return sendEmail({
    to: input.userEmail,
    subject: "Shackles Pass Confirmed - " + input.eventYear,
    html,
  });
}

/**
 * Send team creation email to team leader
 */
export async function sendTeamCreatedEmail(input: {
  leaderEmail: string;
  leaderName: string;
  teamName: string;
  eventName: string;
  joinCode: string;
  joinUrl: string;
  teamMinSize?: number;
  teamMaxSize?: number;
}): Promise<{ success: boolean; error?: string }> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Team Created Successfully</h2>
      <p>Hi ${input.leaderName},</p>
      <p>Your team for <strong>${input.eventName}</strong> has been created!</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <strong>Team Details:</strong>
        <ul>
          <li>Team Name: <strong>${input.teamName}</strong></li>
          <li>Event: <strong>${input.eventName}</strong></li>
          ${input.teamMinSize ? `<li>Min Size: <strong>${input.teamMinSize}</strong></li>` : ""}
          ${input.teamMaxSize ? `<li>Max Size: <strong>${input.teamMaxSize}</strong></li>` : ""}
          <li>Join Code: <strong style="font-size: 18px; color: #0066cc;">${input.joinCode}</strong></li>
        </ul>
      </div>

      <h3>Share with your team members:</h3>
      <p>Team members can join using this link:</p>
      <p><a href="${input.joinUrl}" style="color: #0066cc; text-decoration: none;">Join Team Link</a></p>
      <p>Or use join code: <strong>${input.joinCode}</strong></p>

      <p style="font-size: 12px; color: #666; margin-top: 30px;">
        Once all members have joined and you're ready, you can lock the team from the event page.
      </p>
    </div>
  `;

  return sendEmail({
    to: input.leaderEmail,
    subject: `Team Created: ${input.teamName} - ${input.eventName}`,
    html,
  });
}

/**
 * Send team locked confirmation email to all members
 */
export async function sendTeamLockedEmail(input: {
  memberEmail: string;
  memberName: string;
  teamName: string;
  eventName: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  teamSize: number;
  memberRole: "LEADER" | "MEMBER";
}): Promise<{ success: boolean; error?: string }> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Team Registration Confirmed</h2>
      <p>Hi ${input.memberName},</p>
      <p>Your team registration has been confirmed and locked!</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <strong>Registration Details:</strong>
        <ul>
          <li>Team Name: <strong>${input.teamName}</strong></li>
          <li>Event: <strong>${input.eventName}</strong></li>
          <li>Your Role: <strong>${input.memberRole}</strong></li>
          <li>Team Size: <strong>${input.teamSize} members</strong></li>
          ${input.eventDate ? `<li>Event Date: <strong>${input.eventDate}</strong></li>` : ""}
          ${input.eventTime ? `<li>Event Time: <strong>${input.eventTime}</strong></li>` : ""}
          ${input.eventVenue ? `<li>Venue: <strong>${input.eventVenue}</strong></li>` : ""}
        </ul>
      </div>

      <h3>Important Reminders:</h3>
      <ul>
        <li>Bring your personal ID on the day of the event</li>
        <li>Scan your personal QR code for attendance and kit distribution</li>
        <li>Arrive on time as per event schedule</li>
      </ul>

      <p style="font-size: 12px; color: #666; margin-top: 30px;">
        See you at the event! For questions, contact us at support@shackles.com
      </p>
    </div>
  `;

  return sendEmail({
    to: input.memberEmail,
    subject: `Team Confirmed: ${input.teamName}`,
    html,
  });
}

/**
 * Send individual event registration confirmation
 */
export async function sendEventRegistrationEmail(input: {
  userEmail: string;
  userName: string;
  eventName: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
}): Promise<{ success: boolean; error?: string }> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Event Registration Confirmed</h2>
      <p>Hi ${input.userName},</p>
      <p>You're all set for <strong>${input.eventName}</strong>!</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <strong>Event Details:</strong>
        <ul>
          <li>Event: <strong>${input.eventName}</strong></li>
          ${input.eventDate ? `<li>Date: <strong>${input.eventDate}</strong></li>` : ""}
          ${input.eventTime ? `<li>Time: <strong>${input.eventTime}</strong></li>` : ""}
          ${input.eventVenue ? `<li>Venue: <strong>${input.eventVenue}</strong></li>` : ""}
        </ul>
      </div>

      <h3>Day-of Checklist:</h3>
      <ul>
        <li>Bring your personal ID</li>
        <li>Scan your personal QR code for attendance</li>
        <li>Arrive on time</li>
      </ul>

      <p style="font-size: 12px; color: #666; margin-top: 30px;">
        Thanks for registering! See you at the event!
      </p>
    </div>
  `;

  return sendEmail({
    to: input.userEmail,
    subject: `Registered for: ${input.eventName}`,
    html,
  });
}
