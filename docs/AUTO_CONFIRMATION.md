# Auto-Confirmation Feature

## Overview
This feature automatically confirms service tickets that have been in `awaiting_confirmation` status for more than 30 minutes without requester action.

## How It Works

### 1. Staff Completes Work
- When IT staff marks a ticket as complete, the ticket status becomes `awaiting_confirmation`
- A timestamp (`awaiting_confirmation_since`) is recorded
- The requester is notified and must confirm the completion within 30 minutes

### 2. Manual Confirmation (Preferred)
- If the requester confirms within 30 minutes, the ticket is marked as `resolved`
- The `awaiting_confirmation_since` timestamp is cleared
- No auto-confirmation occurs

### 3. Auto-Confirmation (30-minute timeout)
- If no manual confirmation is received after 30 minutes, the cron job auto-confirms
- The ticket status becomes `resolved`
- The system records this as `auto_confirmed = true`
- Both IT staff and requester are notified

## Database Schema Changes

### New Columns Added
- `awaiting_confirmation_since` (TIMESTAMPTZ): Tracks when ticket entered awaiting_confirmation status
- `auto_confirmed` (BOOLEAN): Flags tickets that were auto-confirmed by the system

### Indexes
- `idx_service_tickets_awaiting_confirmation`: Optimizes queries for finding eligible tickets

## API Endpoints

### POST /api/service-tickets/auto-confirm
Triggers auto-confirmation of eligible tickets. Called by Vercel cron every 10 minutes.

**Response:**
```json
{
  "success": true,
  "message": "Successfully auto-confirmed 5 ticket(s)",
  "count": 5,
  "ticketIds": ["uuid1", "uuid2", ...]
}
```

### GET /api/service-tickets/auto-confirm
Returns count and details of tickets eligible for auto-confirmation. Useful for monitoring.

**Response:**
```json
{
  "status": "ok",
  "eligibleCount": 3,
  "tickets": [
    {
      "id": "uuid",
      "ticket_number": "TK-001",
      "title": "INTERNET ISSUE",
      "awaiting_confirmation_since": "2026-06-09T10:05:35Z"
    }
  ],
  "threshold": "2026-06-09T10:35:35Z",
  "currentTime": "2026-06-09T10:42:00Z"
}
```

## Cron Job Configuration

The vercel.json includes a cron job that runs every 10 minutes:
```json
{
  "path": "/api/service-tickets/auto-confirm",
  "schedule": "*/10 * * * *"
}
```

## Audit Trail

All auto-confirmations are logged in the `audit_logs` table with:
- `action`: "ticket_auto_confirmed"
- `details`: Reason, completed_by, awaiting_since timestamp
- Notifications sent to IT staff and requester

## Customization

To change the auto-confirmation timeout from 30 minutes:
1. Edit `/app/api/service-tickets/auto-confirm/route.ts`
2. Update the calculation: `const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)`
3. Change `30 * 60 * 1000` to desired milliseconds (e.g., `60 * 60 * 1000` for 60 minutes)

To change cron frequency:
1. Edit `vercel.json`
2. Update the `schedule` field (cron format: minute, hour, day, month, day-of-week)
3. Current: `*/10 * * * *` = every 10 minutes
