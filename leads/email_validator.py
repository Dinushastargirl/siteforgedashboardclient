"""
SiteForge Email Validator
=========================
Scans master_leads.csv and classifies every email as:
  ✅ VALID   — personal/business email, safe to send
  ⚠️  RISKY   — free providers (Gmail/Yahoo/Hotmail) or non-business domains
  ❌ BAD     — missing, N/A, generic prefix (info@/admin@/support@), .edu, disposable

Outputs:
  cleaned_leads.csv   — VALID + RISKY leads (ready to outreach)
  rejected_leads.csv  — BAD leads (for reference)
"""

import csv
import os
import re
from collections import defaultdict
from typing import Tuple

# ── Configuration ──────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV  = os.path.join(BASE_DIR, "master_leads.csv")
CLEAN_CSV  = os.path.join(BASE_DIR, "cleaned_leads.csv")
REJECT_CSV = os.path.join(BASE_DIR, "rejected_leads.csv")

# Generic prefixes that signal a shared/unmanned inbox
GENERIC_PREFIXES = {
    "info", "admin", "support", "contact", "hello", "sales",
    "noreply", "no-reply", "webmaster", "postmaster", "help",
    "enquiries", "enquiry", "office", "mail", "marketing",
    "team", "service", "services", "billing", "accounts",
}

# Disposable / temp-email domains
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
    "sharklasers.com", "guerrillamailblock.com", "yopmail.com",
    "trashmail.com", "maildrop.cc", "dispostable.com", "spamgourmet.com",
    "fakeinbox.com", "spamgourmet.net", "mailnull.com",
}

# Free / consumer providers — deliverable but high-risk for cold outreach
FREE_PROVIDERS = {
    "gmail.com", "yahoo.com", "yahoo.co.uk", "yahoo.ca", "hotmail.com",
    "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com",
    "me.com", "mac.com", "comcast.net", "sbcglobal.net", "att.net",
    "verizon.net", "cox.net", "charter.net", "earthlink.net",
    "wk.net",  # regional ISP — flagged in your current list
}

# Academic domains — almost always wrong for business outreach
ACADEMIC_TLD_PATTERNS = [".edu", ".ac.uk", ".edu.au"]


# ── Core Classifier ────────────────────────────────────────────────────────────

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def classify_email(raw_email: str) -> Tuple[str, str]:
    """
    Returns (classification, reason).
    Classification is one of: 'VALID', 'RISKY', 'BAD'
    """
    if not raw_email or raw_email.strip().upper() in ("N/A", "NA", "NONE", "", "-"):
        return "BAD", "Missing / N/A"

    email = raw_email.strip().lower()

    # Basic format check
    if not EMAIL_REGEX.match(email):
        return "BAD", "Invalid format"

    local, domain = email.rsplit("@", 1)

    # Disposable domain
    if domain in DISPOSABLE_DOMAINS:
        return "BAD", f"Disposable domain ({domain})"

    # Academic domain
    for acad in ACADEMIC_TLD_PATTERNS:
        if domain.endswith(acad):
            return "BAD", f"Academic email ({domain})"

    # Generic prefix
    base_local = local.split("+")[0]  # strip + aliases
    if base_local in GENERIC_PREFIXES:
        return "BAD", f"Generic prefix ({local}@)"

    # Free / consumer provider — risky but not dead
    if domain in FREE_PROVIDERS:
        return "RISKY", f"Free provider ({domain})"

    # Looks like a real business email
    return "VALID", f"Business email ({domain})"


# ── Duplicate Detector ─────────────────────────────────────────────────────────

def is_duplicate(email: str, seen: set) -> bool:
    normalized = email.strip().lower()
    if normalized in seen:
        return True
    seen.add(normalized)
    return False


# ── Main ───────────────────────────────────────────────────────────────────────

def run():
    if not os.path.exists(INPUT_CSV):
        print(f"[ERROR] Could not find: {INPUT_CSV}")
        return

    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames or []

    if not rows:
        print("[ERROR] CSV is empty.")
        return

    # Add classification columns
    extended_fields = fieldnames + ["email_status", "email_reason"]

    clean_rows   = []
    rejected_rows = []
    stats = defaultdict(int)
    seen_emails = set()

    for row in rows:
        raw_email = row.get("validated_email", "").strip()
        status, reason = classify_email(raw_email)

        # Check for duplicates (only among non-BAD emails)
        if status != "BAD" and is_duplicate(raw_email, seen_emails):
            status = "BAD"
            reason = "Duplicate email"

        row["email_status"] = status
        row["email_reason"]  = reason
        stats[status] += 1

        if status in ("VALID", "RISKY"):
            clean_rows.append(row)
        else:
            rejected_rows.append(row)

    # Write cleaned leads
    with open(CLEAN_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=extended_fields)
        writer.writeheader()
        writer.writerows(clean_rows)

    # Write rejected leads
    with open(REJECT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=extended_fields)
        writer.writeheader()
        writer.writerows(rejected_rows)

    # ── Print Report ──
    total = len(rows)
    print("\n" + "="*55)
    print("  SiteForge Email Validator - Report")
    print("="*55)
    print(f"  Total leads scanned  : {total}")
    print(f"  [OK]  VALID              : {stats['VALID']}  (safe to send)")
    print(f"  [!!]  RISKY              : {stats['RISKY']}  (free/ISP provider)")
    print(f"  [X]   BAD                : {stats['BAD']}  (removed)")
    print("-"*55)
    print(f"  --> cleaned_leads.csv  : {len(clean_rows)} leads saved")
    print(f"  --> rejected_leads.csv : {len(rejected_rows)} leads archived")
    print("="*55)

    # ── Show sample VALID leads ──
    valids = [r for r in clean_rows if r["email_status"] == "VALID"]
    if valids:
        print(f"\n  Sample VALID leads (showing up to 10):\n")
        for r in valids[:10]:
            print(f"    {r['business_name']:<35} -> {r['validated_email']}")
    print()


if __name__ == "__main__":
    run()
