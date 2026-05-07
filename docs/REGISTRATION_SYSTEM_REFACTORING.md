# Registration System Refactoring - Implementation Guide

## Overview
This document summarizes the registration system refactoring to support package-based symposium passes, modern team registration workflows, and time clash prevention.

## What Was Implemented

### 1. Prisma Schema Updates
**Location:** `prisma/schema.prisma`

**New Enums:**
- `PackageType`: EVENT_ONLY, WORKSHOP_ONLY, COMBO
- `EventCategory`: EVENT, WORKSHOP
- Updated `TeamStatus`: OPEN, DRAFT, LOCKED, COMPLETED

**Model Updates:**
- `Payment`: Added `packageType` and `year` fields for package tracking
- `Event`: Added `category` and `allDay` fields
- `Team`: Added `joinCode` field for team join invitations

### 2. Core Services Created

#### Email Service (`src/server/services/email.service.ts`)
Sends transactional emails via Resend:
- `sendPaymentVerificationEmail()` - When payment is verified
- `sendTeamCreatedEmail()` - When team is created
- `sendTeamLockedEmail()` - When team is locked
- `sendEventRegistrationEmail()` - When individual event registered

**Setup Required:**
```env
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@shackles.com
```

#### Registration Helpers (`src/server/services/registration-helpers.service.ts`)
Shared validation logic:
- `getVerifiedPackage()` - Check if user has valid package for year
- `canAccessEventCategory()` - Verify package allows event category
- `ensureNoTimeClash()` - Prevent overlapping event registrations
- `generateQRToken()` - Create secure QR tokens
- `generateJoinCode()` - Create short team invite codes
- `validateTeamSize()` - Verify team size constraints
- `DomainError` - Custom error class for domain logic failures

#### QR Management (`src/server/services/qr-management.service.ts`)
Handles QR code lifecycle:
- `generateQRTokenForUser()` - Create QR when payment verified
- `processQRScan()` - Handle scanner input at stations
- `getQRScanHistory()` - Retrieve scan logs
- `validateQRToken()` - Verify QR token validity

#### Team Operations (`src/server/services/team-operations.service.ts`)
Package-aware team management:
- `createTeamForEvent()` - Leader creates team with join code
- `joinTeamByCode()` - Members join by code
- `lockTeam()` - Finalize team, prevent new members

All functions enforce:
- ✅ Package eligibility checks
- ✅ Time clash prevention
- ✅ Payment verification for active year
- ✅ Team size constraints
- ✅ Email notifications

### 3. Updated Existing Services

#### Event Registration (`src/server/services/event-registration.service.ts`)
New function:
- `registerForIndividualEvent()` - Individual registration with all checks

Updated function:
- `quickRegisterAndMarkAttendance()` - Added package and time clash checks

#### Team Registration (`src/server/services/team-registration.service.ts`)
Updated functions with package/time clash checks:
- `addMemberToTeamEvent()`
- `bulkRegisterTeamByShacklesIds()`
- `bulkRegisterAndLockTeamByShacklesIds()`

### 4. QR Scanner Endpoint
**Location:** `src/app/api/scanner/qr-scan/route.ts`

**Endpoint:** `POST /api/scanner/qr-scan`

**Request:**
```json
{
  "qrToken": "hex_string",
  "stationId": "station_id",
  "eventId": "event_id_optional",
  "operationType": "ATTENDANCE|KIT|OTHER"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user_id",
  "shacklesId": "SH26GN001",
  "userName": "John Doe",
  "message": "Attendance marked for John Doe"
}
```

## Key Design Decisions

### 1. Time Clash Logic
- ✅ Users can join unlimited events
- ✅ But cannot register for overlapping events
- ✅ Exception: All-day events don't block others
- ✅ Checked at registration, not at check-in

### 2. Package Eligibility
- ✅ Stored with year (supports year rollover)
- ✅ Checked by event category (not per-event)
- ✅ Same package applies to all events in a year
- ✅ Updated only when payment is verified

### 3. Team Lifecycle
- ✅ Create → Open → Locked
- ✅ Leader creates with join code
- ✅ Members join via code
- ✅ Leader locks when ready
- ✅ Automatic email notifications at each step

### 4. QR Tokens
- ✅ Generated when payment verified
- ✅ Single QR per user per year
- ✅ Used across all stations
- ✅ Includes user + year scope

## Integration Checklist

### Server Actions / API Routes to Update

- [ ] Payment verification action → Call `generateQRTokenForUser()` + send email
- [ ] Individual event registration page → Use `registerForIndividualEvent()`
- [ ] Team creation page → Use `createTeamForEvent()`
- [ ] Team join page → Use `joinTeamByCode()`
- [ ] Team management page → Use `lockTeam()`
- [ ] On-spot registration flows → Use updated `addMemberToTeamEvent()` and `bulkRegisterTeamByShacklesIds()`

### Database Migrations

Required:
```bash
npx prisma migrate dev --name add_packages_and_team_join_codes
```

### Environment Configuration

Add to `.env`:
```env
RESEND_API_KEY=your_key_here
RESEND_FROM_EMAIL=noreply@shackles.com
```

## Error Handling

All services return consistent error formats:

**Domain Errors** (from helpers):
```typescript
throw new DomainError(
  "TIME_CLASH",
  "User message here",
  { additionalDetails }
)
```

**Service Results**:
```typescript
{
  success: false,
  reason: "ERROR_CODE",
  error: "User-friendly message",
  details?: { /* extra context */ }
}
```

## Testing Scenarios

1. **Package Eligibility**
   - EVENT_ONLY can't join WORKSHOP
   - WORKSHOP_ONLY can't join EVENT
   - COMBO can join both

2. **Time Clash**
   - 2-3 PM event + 2:30-4 PM event = blocked
   - All-day event + timed event = allowed
   - Same time slots across years = allowed

3. **Team Operations**
   - Create team → Leader registered
   - Join by code → Member added
   - Lock team → No more joins allowed
   - Emails sent at each step

4. **QR Scanning**
   - Valid token → Process operation
   - Expired token → Reject
   - No registration for event → Reject for attendance

## Performance Considerations

- Time clash checks: O(n) where n = user's registrations in year (typically < 10)
- QR scan: O(1) lookup by token + O(1) record creation
- Team join: O(1) lookup + transactional safety against race conditions
- Email sending: Async, non-blocking (via Resend API)

## Security Notes

- QR tokens: 32-byte random hex (256-bit entropy)
- Join codes: 6-char alphanumeric (36^6 ≈ 2.1 billion combinations)
- Payment verification: Admin-verified, not automatic
- Year scoping: Prevents cross-year access

## Next Steps

1. **Install Resend** (if not already done):
   ```bash
   npm install resend
   ```

2. **Update payment verification flow** to call:
   - `generateQRTokenForUser()`
   - `sendPaymentVerificationEmail()`

3. **Create UI flows** for:
   - Individual event registration
   - Team creation with join code display
   - Team join by code
   - Team locking

4. **Integrate scanner** with QR management:
   - Scanner app → POST to `/api/scanner/qr-scan`
   - Display response to station operator

5. **Test end-to-end** workflows with test data

## File Structure

```
src/server/services/
├── email.service.ts                    (NEW)
├── registration-helpers.service.ts     (NEW)
├── qr-management.service.ts            (NEW)
├── team-operations.service.ts          (NEW)
├── event-registration.service.ts       (UPDATED)
├── team-registration.service.ts        (UPDATED)
└── [other existing services]

src/app/api/scanner/
└── qr-scan/route.ts                    (NEW)

prisma/
└── schema.prisma                       (UPDATED)
```

## Support

For implementation questions or issues with the services, refer to:
- Service function JSDoc comments
- Error messages returned by domain validation
- Test scenarios outlined above
