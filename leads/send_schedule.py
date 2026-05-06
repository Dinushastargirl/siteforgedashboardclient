"""
SiteForge Send Schedule
========================
Reads outreach_emails.csv and builds a safe day-by-day send plan.

Rules (following Gmail warm-up best practice):
  Day 1–2  :  10 emails/day
  Day 3–4  :  20 emails/day
  Day 5+   :  30 emails/day (max for free Gmail)
  Delay    :  90 seconds between each send

Outputs:
  send_schedule.csv — each email assigned to a day + time slot
  Prints a full schedule to the terminal
"""

import csv
import os
from datetime import datetime, timedelta

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV   = os.path.join(BASE_DIR, "outreach_emails.csv")
OUTPUT_CSV  = os.path.join(BASE_DIR, "send_schedule.csv")

# ── Schedule Config ─────────────────────────────────────────────────────────────

DELAY_SECONDS   = 90    # seconds between each email
START_HOUR      = 9     # start sending at 9 AM
START_DAY_OFFSET = 0    # 0 = start tomorrow (recommended), 1 = in 2 days

# Ramp-up plan: (max_emails_per_day, label)
RAMP_PLAN = [
    (10, "Day 1 — Warm-up"),
    (10, "Day 2 — Warm-up"),
    (20, "Day 3 — Ramp up"),
    (20, "Day 4 — Ramp up"),
    (30, "Day 5 — Cruise"),
    (30, "Day 6 — Cruise"),
    (30, "Day 7 — Cruise"),
    (30, "Day 8 — Cruise"),
    (30, "Day 9 — Cruise"),
    (30, "Day 10 — Cruise"),
]

# ── Niche-specific best send times (24h) ───────────────────────────────────────
# Helps deliverability by mimicking natural sending behavior

NICHE_BEST_HOURS = {
    "farm":         [8, 9, 10],     # farmers are up early
    "barbershop":   [11, 12, 14],   # mid-day when not busy
    "restaurant":   [10, 11, 15],   # before lunch rush or afternoon lull
    "retail":       [10, 11, 14],   # morning or post-lunch
    "construction": [7, 8, 9],      # early morning
    "auto":         [9, 10, 11],    # morning
    "general":      [9, 10, 11],    # safe default
}


# ── Main ────────────────────────────────────────────────────────────────────────

def run():
    if not os.path.exists(INPUT_CSV):
        print(f"[ERROR] Could not find: {INPUT_CSV}")
        print("  → Run email_generator.py first to generate outreach_emails.csv")
        return

    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows   = list(reader)

    if not rows:
        print("[ERROR] outreach_emails.csv is empty.")
        return

    total_emails = len(rows)

    # Calculate how many days we need based on ramp plan
    scheduled_rows = []
    email_idx = 0
    day_num   = 1
    base_date = datetime.now() + timedelta(days=START_DAY_OFFSET + 1)

    for plan_idx, (daily_limit, label) in enumerate(RAMP_PLAN):
        if email_idx >= total_emails:
            break

        send_date = base_date + timedelta(days=plan_idx)
        batch = rows[email_idx : email_idx + daily_limit]

        # Assign times — space by DELAY_SECONDS, jitter start hour per niche
        send_time = datetime(send_date.year, send_date.month, send_date.day,
                             START_HOUR, 0, 0)

        for i, row in enumerate(batch):
            niche     = row.get("niche_detected", "general")
            best_hours = NICHE_BEST_HOURS.get(niche, [9, 10, 11])

            # On first email of the day, snap to a niche-appropriate hour
            if i == 0:
                hour = best_hours[day_num % len(best_hours)]
                send_time = datetime(send_date.year, send_date.month, send_date.day,
                                     hour, 0, 0)

            scheduled_rows.append({
                "day":           day_num,
                "day_label":     label,
                "send_date":     send_date.strftime("%Y-%m-%d"),
                "send_time":     send_time.strftime("%H:%M:%S"),
                "to_email":      row.get("to_email", ""),
                "subject":       row.get("subject", ""),
                "business_name": row.get("business_name", ""),
                "niche":         niche,
                "city":          row.get("city", ""),
                "status":        "PENDING",
            })

            send_time += timedelta(seconds=DELAY_SECONDS)

        email_idx += len(batch)
        day_num   += 1

    # If we still have more emails beyond the ramp plan, continue at 30/day
    extra_day = day_num
    while email_idx < total_emails:
        send_date = base_date + timedelta(days=(extra_day - 1))
        batch = rows[email_idx : email_idx + 30]
        send_time = datetime(send_date.year, send_date.month, send_date.day,
                             START_HOUR, 0, 0)

        label = f"Day {extra_day} — Cruise"
        for i, row in enumerate(batch):
            niche      = row.get("niche_detected", "general")
            scheduled_rows.append({
                "day":           extra_day,
                "day_label":     label,
                "send_date":     send_date.strftime("%Y-%m-%d"),
                "send_time":     send_time.strftime("%H:%M:%S"),
                "to_email":      row.get("to_email", ""),
                "subject":       row.get("subject", ""),
                "business_name": row.get("business_name", ""),
                "niche":         niche,
                "city":          row.get("city", ""),
                "status":        "PENDING",
            })
            send_time += timedelta(seconds=DELAY_SECONDS)

        email_idx += len(batch)
        extra_day += 1

    # ── Write CSV ──
    output_fields = ["day", "day_label", "send_date", "send_time",
                     "to_email", "subject", "business_name", "niche", "city", "status"]

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_fields)
        writer.writeheader()
        writer.writerows(scheduled_rows)

    # ── Print Report ──
    total_days = extra_day - 1 if email_idx >= total_emails else day_num - 1

    print("\n" + "="*65)
    print("  SiteForge Send Schedule - Plan")
    print("="*65)
    print(f"  Total emails to send   : {total_emails}")
    print(f"  Total days needed      : {total_days}")
    print(f"  Delay between emails   : {DELAY_SECONDS} seconds")
    print(f"  First send date        : {(base_date).strftime('%Y-%m-%d')} at {START_HOUR:02d}:00")
    print("-"*65)
    print("  Day-by-Day Plan:\n")

    current_day = 0
    for r in scheduled_rows:
        if r["day"] != current_day:
            current_day = r["day"]
            day_emails = [x for x in scheduled_rows if x["day"] == current_day]
            print(f"  [DAY] {r['day_label']:<25} | {r['send_date']} | {len(day_emails)} emails")

    print()
    print("  [OK] Full schedule saved to: send_schedule.csv")
    print()
    print("  [!]  IMPORTANT RULES:")
    print("  1. Wait 24-48 hours before starting (let your account cool down)")
    print("  2. Only send from ONE Gmail tab - don't open multiple compose windows")
    print("  3. If Gmail warns you again - STOP for 48 hours immediately")
    print("  4. Upgrade to Google Workspace (dinusha@siteforge.lk) ASAP for better limits")
    print("="*65)
    print()


if __name__ == "__main__":
    run()
