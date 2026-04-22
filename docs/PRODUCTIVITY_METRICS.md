# Staff Productivity Metrics System

## Overview
The productivity metrics system tracks and ranks IT staff performance based on task completion rates, on-time delivery, and completion speed.

## Features

### Auto‑confirmation & Admin Overrides

- Tickets that remain in the `awaiting_confirmation` state for more than 30 minutes are
  automatically transitioned to `resolved`.  The original `completed_at` timestamp
  (when the IT staff member marked the job done) is used as the closure time
  for all productivity calculations.
- Administrators and IT Heads may also force‑confirm all pending tickets at once
  by clicking the **Confirm All** button on the Service Desk dashboard, or by
  calling the `POST /api/service-tickets/confirm-all` endpoint.  This allows
  confirmations to be applied on behalf of requesting staff when necessary.

## Features

### 1. Productivity Scoring Algorithm
The system calculates a comprehensive productivity score (0-100) for each staff member, **prioritizing task volume** as the dominant success metric. Staff who complete more tasks rank higher, reflecting their higher contribution to the organization.

**Score Components:**
- **80%** - Task Volume (PRIMARY): Actual number of tasks completed (normalized 0-100 where 50+ tasks = 100)
- **10%** - Speed Bonus: Bonus points for faster average completion times
- **5%** - On-Time Completion Rate: Percentage of tasks completed within expected timeframe
- **5%** - Completion Rate: Percentage of assigned tasks that were completed

**Why Task Volume is Primary (80%):**
Staff who handle and complete more tasks demonstrate significantly higher capacity, reliability, and contribution. A staff member who completes 40 tasks ranks substantially higher than someone who completes 8 tasks. This ensures high-volume workers are properly recognized as top performers.

**Speed Bonus Tiers (10%):**
- ≤3 days average completion: +20 points
- 3-5 days average completion: +10 points
- 5-7 days average completion: +5 points
- >7 days average completion: +0 points

**On-Time Completion Rate (5%):**
- Tasks completed on or before their expected completion date
- Minor weight ensures deadline adherence is rewarded but doesn't override volume

**Completion Rate (5%):**
- Secondary metric that accounts for task assignment efficiency
- (Completed tasks / Total assigned tasks) × 100
- Low weight ensures high-volume workers aren't penalized

**Final Score Formula:**
```
VolumeScore = (CompletedTaskCount / 50) × 100 (capped at 100)
Score = (VolumeScore × 0.80) + (SpeedBonus × 0.10) + (OnTimeRate × 0.05) + (CompletionRate × 0.05)
```

**Example Rankings:**
- Theophilus: 40 tasks (80 volume) + 10pt speed + 90% on-time + 80% rate = ~82 score ✓ Top performer
- John: 8 tasks (16 volume) + 15pt speed + 100% on-time + 100% rate = ~23 score ✓ Lower performer
- This ensures productivity is fairly measured by actual output - more tasks = higher ranking.

### 2. Expected Completion Times by Priority
Tasks have different expected completion timeframes based on priority:
- **Critical**: 1 day
- **High**: 3 days
- **Medium**: 5 days
- **Low**: 10 days

Tasks completed within these timeframes count toward the on-time completion rate.

### 3. Performance Grading
Staff are assigned performance grades based on their productivity score (adjusted for volume-weighted scoring):
- **Excellent**: Score ≥90
- **Good**: Score 75-89
- **Average**: Score 55-74
- **Below Average**: Score 35-54
- **Poor**: Score <35

### 4. Ranking System
Staff members are ranked from 1 (highest) to N (lowest) based on their productivity score. The top 3 performers are highlighted with trophy icons.

## API Endpoints

### GET /api/staff/productivity-metrics
Calculates and returns productivity metrics for all IT staff.

**Query Parameters:**
- `startDate` (optional): ISO date string for the start of the analysis period
- `endDate` (optional): ISO date string for the end of the analysis period
- `location` (optional): Filter by location (or "all" for all locations)

**Response:**
```json
{
  "success": true,
  "metrics": [
    {
      "staffId": "uuid",
      "staffName": "John Doe",
      "email": "john@example.com",
      "location": "Accra",
      "role": "it_staff",
      "totalTasksAssigned": 45,
      "completedTasks": 38,
      "onTimeCompletions": 32,
      "averageCompletionDays": 4.2,
      "completionRate": 84.4,
      "onTimeRate": 84.2,
      "productivityScore": 88,
      "speedBonus": 10,
      "rank": 1,
      "grading": "Excellent"
    }
  ],
  "summary": {
    "totalStaff": 37,
    "avgProductivityScore": 65.3,
    "totalTasksAssigned": 1234,
    "totalCompletedTasks": 856,
    "avgCompletionRate": 69.4,
    "avgOnTimeRate": 72.8
  }
}
```

## User Interface

### Staff Performance Report Page
Location: `/dashboard/staff-performance-report`

**Features:**
- **Top Performers Section**: Highlights the top 3 performers with trophy badges
- **Full Rankings Table**: Complete sortable table of all staff with detailed metrics
- **Filters**:
  - Date Range: This Year, This Quarter, This Month
  - Location: Filter by specific location or view all
- **Export**: Export complete report to CSV format
- **Scoring Methodology Card**: Explains how scores are calculated

### IT Staff Work Status Page
Location: `/dashboard/it-staff-status`

Updated to include:
- Link to detailed performance report: "View Performance Metrics" button
- Individual productivity scores displayed on each staff card
- Performance color coding (green = excellent, yellow = good, orange = average, red = poor)

## Store Access for Users

### View-Only Access for "user" Role
Users with the "user" role now have read-only access to Central Stores stock levels:

**Features:**
- Can view Central Stores inventory only
- Cannot modify inventory or submit requisitions
- Prominent notice explaining view-only access
- Clear guidance to contact IT Head for equipment requests

**Location:** `/dashboard/store-snapshot`

## Usage for Year-End Assessments

1. **Navigate to Staff Performance Report**
   - Go to Dashboard → IT Operations → Staff Performance Report

2. **Select Date Range**
   - Choose "This Year" for annual assessment
   - Or select specific quarter/month for periodic reviews

3. **Review Rankings**
   - View top performers in the featured cards section
   - Review complete rankings in the table
   - Sort and filter by location if needed

4. **Export for Records**
   - Click "Export Report" to download CSV
   - Use exported data for HR reviews and bonuses

5. **Key Metrics to Consider**
   - **Productivity Score**: Overall performance indicator
   - **Completion Rate**: Reliability in finishing assigned tasks
   - **On-Time Rate**: Ability to meet deadlines
   - **Average Completion Days**: Speed and efficiency
   - **Grading**: Quick performance summary

## Benefits

- **Objective Performance Measurement**: Data-driven assessment eliminates bias
- **Rewards Fast, Quality Work**: Speed bonus incentivizes efficiency
- **Clear Expectations**: Staff know what's measured and how
- **Fair Ranking**: Transparent algorithm treats everyone equally
- **Year-End Ready**: Export reports for annual reviews
- **Identifies Top Performers**: Easy to spot high achievers for recognition
- **Highlights Areas for Improvement**: Low performers get targeted support

## Technical Details

### Data Sources
- `repair_requests` table: Device repair tasks
- `service_tickets` table: IT support tickets
- `profiles` table: Staff information

### Calculation Frequency
- Metrics are calculated in real-time when the report is accessed
- No caching, always reflects current data

### Roles with Access
- Admin
- IT Head
- Regional IT Head

These roles can view the performance report for all staff within their scope (location-based filtering applies for regional IT heads).
