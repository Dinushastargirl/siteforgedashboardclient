"""
SiteForge Personalized Email Generator
=======================================
Reads cleaned_leads.csv (output from email_validator.py) and generates
a UNIQUE, personalized email for every business — different subject,
different hook, different tone — so Gmail never sees duplicate content.

Outputs:
  outreach_emails.csv — columns: to_email, subject, body, business_name, niche, city
"""

import csv
import os
import random
import re
from datetime import datetime
from typing import Tuple

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV  = os.path.join(BASE_DIR, "cleaned_leads.csv")
OUTPUT_CSV = os.path.join(BASE_DIR, "outreach_emails.csv")

# ── Sender Info (update these) ─────────────────────────────────────────────────

SENDER_NAME    = "Dinusha"
COMPANY_NAME   = "SiteForge"
SENDER_EMAIL   = "info.siteforge101@gmail.com"   # change to dinusha@siteforge.lk when ready
PORTFOLIO_LINK = "https://siteforge.lk"          # update with your actual portfolio

# ── Niche Profiles ─────────────────────────────────────────────────────────────
# Each niche has:
#   subjects   — list of subject line templates
#   hooks      — opening line templates (personalized to {name} and {city})
#   pain_points — what problem you're solving for them
#   ctas        — call to action closing lines

NICHE_PROFILES = {

    "farm": {
        "keywords": ["farm", "maple", "orchard", "sugarhouse", "honey", "dairy", "produce",
                     "agriculture", "hydro", "beefalo", "ranch", "acres", "creamery"],
        "subjects": [
            "Quick question about {name}",
            "{name} — have you thought about online orders?",
            "Helping {name} reach more customers online",
            "Your products deserve to be seen, {name}",
            "{city} customers are searching for farms like yours",
        ],
        "hooks": [
            "I was looking for local farms in {city} and came across {name} — great operation you've got.",
            "I noticed {name} doesn't have a website yet, and a lot of {city} locals are searching online for exactly what you offer.",
            "People in {city} are actively looking for local farms and farm-fresh products online — {name} should be showing up.",
            "I came across {name} while researching {city} farms. Your products look amazing — more people need to know about them.",
            "Farms like {name} in {city} are missing out on online orders because customers can't find them easily.",
        ],
        "value": [
            "A simple website lets you showcase your products, accept online orders, and get found on Google Maps.",
            "With a small, clean website I can set up, people in {city} would be able to find you, see what you sell, and contact you directly.",
            "I build fast, affordable websites for farms — including a product showcase, contact form, and Google Maps listing.",
            "I can build you a site in under a week that shows your products, your story, and makes it easy for people to reach you.",
        ],
        "cta": [
            "Would you be open to a quick 10-minute chat this week?",
            "Can I send you a free mock-up of what a site for {name} could look like?",
            "I'd love to show you what I've built for other farms — happy to share examples.",
            "No pressure at all — just curious if it's something you'd want to explore.",
        ],
    },

    "barbershop": {
        "keywords": ["barber", "kutz", "cuts", "blendz", "blade", "fade", "hair", "barbershop",
                     "salon", "studio", "lounge"],
        "subjects": [
            "More bookings for {name}?",
            "{name} — are clients booking you online yet?",
            "Quick idea for {name} in {city}",
            "Help {name} get found on Google",
            "{city} people are searching for barbers — is {name} showing up?",
        ],
        "hooks": [
            "I was looking for barbers in {city} and {name} came up — but I couldn't find a website or booking page.",
            "I checked out {name} — your work looks sharp. But people searching Google for barbers in {city} won't be able to find you without a website.",
            "Barbers in {city} with a booking page get way more walk-ins. I noticed {name} doesn't have one yet.",
            "I found {name} while researching {city} — looks like a solid spot. A simple booking site could double your appointments.",
            "Most people in {city} search Google or Instagram before visiting a barber. {name} deserves to show up.",
        ],
        "value": [
            "I build clean booking sites for barbers — clients see your services, prices, and can book directly. No app needed.",
            "A one-page site with your services, gallery, and a booking button could bring you 10–15 new clients per month.",
            "I can set you up with a site that shows your cuts, links your socials, and lets people book instantly.",
            "My sites for barbers load fast on mobile, show up on Google, and include a simple appointment form.",
        ],
        "cta": [
            "Interested? I can show you what it'd look like for {name} — no obligation.",
            "Would a free mock-up help? I can put one together for {name} this week.",
            "Happy to hop on a quick call or just send you some examples — whatever works for you.",
            "No pressure — just let me know if you want to see what's possible.",
        ],
    },

    "restaurant": {
        "keywords": ["diner", "restaurant", "grill", "cafe", "kitchen", "eatery", "seafood",
                     "food", "bbq", "bistro", "bar", "wings", "shack", "tavern", "house"],
        "subjects": [
            "Is {name}'s menu online?",
            "{name} — quick question about your online presence",
            "People in {city} are searching for restaurants like yours",
            "More tables for {name}?",
            "Quick idea for {name} in {city}",
        ],
        "hooks": [
            "I searched for restaurants in {city} and found {name} — but couldn't find a menu or website.",
            "I came across {name} in {city} — love the concept. But if people can't find your menu online, you're losing reservations.",
            "I was checking out places to eat in {city} and noticed {name} doesn't have an online menu yet.",
            "When people in {city} search for food, they look at menus first. {name} deserves to show up.",
            "I looked up {name} — sounds like a great spot. A website with your menu could bring in a lot more local customers.",
        ],
        "value": [
            "I build simple restaurant sites — menu, photos, hours, and a contact page — that get you found on Google.",
            "A clean website with your menu and location can help {name} show up when people search for food in {city}.",
            "I can set up a fast mobile-friendly site with your menu, story, and a reservation or contact form.",
            "My restaurant sites include a Google Maps embed, online menu, and photo gallery — everything people look for before they visit.",
        ],
        "cta": [
            "Would you be open to seeing a free sample of what a site for {name} could look like?",
            "Can I put together a quick mock-up for {name} this week — no charge?",
            "Happy to send some examples of sites I've built for similar restaurants.",
            "No pressure — just let me know if it's something worth exploring.",
        ],
    },

    "retail": {
        "keywords": ["shop", "store", "boutique", "gift", "supply", "hardware", "market",
                     "goods", "furniture", "decor", "clothing", "apparel", "cigar", "books",
                     "art", "gallery", "tools", "accessories"],
        "subjects": [
            "Helping {name} sell online",
            "{name} — are your products visible online?",
            "Quick question for {name} in {city}",
            "More local customers for {name}?",
            "{city} shoppers are looking for stores like yours",
        ],
        "hooks": [
            "I was looking for shops in {city} and came across {name} — looks like a great store. Do you have an online presence?",
            "I found {name} while researching {city} retailers. Without a website, you're invisible to anyone who searches Google first.",
            "A lot of {city} shoppers look online before visiting a store in person. I noticed {name} doesn't have a site yet.",
            "I came across {name} — the products look fantastic. A website would let people discover you before they even leave home.",
            "People searching for {city} shops often find a website first. {name} could be showing up — but isn't yet.",
        ],
        "value": [
            "I build clean retail sites with your product showcase, store hours, location, and contact info.",
            "A simple website helps {name} show up on Google, attract local shoppers, and build credibility.",
            "I can create a site that shows your best products, links your socials, and gets you found in {city}.",
            "My retail sites are mobile-first, load fast, and are optimized to show up when people search locally.",
        ],
        "cta": [
            "I can put together a free mock-up for {name} — want to take a look?",
            "Would it be worth a 10-minute chat to see if a site makes sense for {name}?",
            "Happy to send examples of what I've built for similar shops in {city}.",
            "No commitment needed — just let me know if you'd like to see what's possible.",
        ],
    },

    "construction": {
        "keywords": ["construction", "contractor", "builder", "builders", "handyman", "remodel",
                     "woodwork", "design", "fabrication", "build", "development", "enterprises",
                     "contracting"],
        "subjects": [
            "Are clients finding {name} online?",
            "{name} — a quick idea for more leads",
            "Helping {name} get more quote requests",
            "{city} homeowners search before they hire — is {name} showing up?",
            "Quick question for {name}",
        ],
        "hooks": [
            "I was looking for contractors in {city} and found {name} — but couldn't find a website or portfolio.",
            "Homeowners in {city} Google contractors before calling anyone. I noticed {name} doesn't have a site yet.",
            "I came across {name} while researching {city} builders. A portfolio site could bring you quote requests on autopilot.",
            "People searching for {city} contractors trust businesses with a website first. {name} deserves to show up.",
            "I found {name} and was impressed — but without a website, a lot of potential clients won't even know you exist.",
        ],
        "value": [
            "I build contractor sites with a project portfolio, services list, and a quote request form.",
            "A website for {name} would show your past work, build trust, and get homeowners to reach out directly.",
            "I can set up a professional site in under a week — project gallery, testimonials, contact form, and local SEO.",
            "My contractor sites are built to generate quote requests: clean, mobile-friendly, and easy for clients to navigate.",
        ],
        "cta": [
            "Want me to put together a free mock-up for {name}? No strings attached.",
            "I'd love to show you what a site for {name} could look like — can I send a sample?",
            "Happy to share some examples from similar contractors in {city}.",
            "Would a 10-minute call make sense? Just to see if it's a good fit.",
        ],
    },

    "auto": {
        "keywords": ["auto", "car", "garage", "mechanic", "body", "repair", "service", "tire"],
        "subjects": [
            "Is {name} showing up when people search for mechanics in {city}?",
            "More customers for {name}?",
            "{name} — quick question about your Google presence",
            "People in {city} search for auto shops online first",
            "Quick idea for {name}",
        ],
        "hooks": [
            "I searched for auto repair in {city} and {name} didn't show up online — that's customers going elsewhere.",
            "I found {name} while researching {city} mechanics. Without a website, you're missing out on people who search before calling.",
            "Most people in {city} Google 'mechanic near me' before choosing a shop. I noticed {name} doesn't have a site yet.",
            "I came across {name} — looks like a trusted shop. A website would help you show up when locals search for repairs.",
            "Car owners in {city} check online reviews and websites before visiting. {name} could be getting more of those calls.",
        ],
        "value": [
            "I build auto shop sites with your services, hours, location, and a review showcase to build trust fast.",
            "A site for {name} would show your services, get you on Google Maps, and let customers book or call directly.",
            "I can set up a clean one-page site with your specialties, contact info, and Google Maps integration.",
            "My auto shop sites load fast on mobile and are set up to appear in local Google searches.",
        ],
        "cta": [
            "Want to see a free mock-up of what a site for {name} could look like?",
            "Happy to share examples — no pressure, just to give you an idea.",
            "Would a quick call work? Just 10 minutes to walk you through what's possible.",
            "No obligation — let me know if this is something worth exploring.",
        ],
    },

    # Default fallback for any unmatched niche
    "general": {
        "subjects": [
            "Quick question for {name}",
            "{name} — getting found online in {city}?",
            "Helping {name} reach more customers",
            "A simple idea for {name}",
            "{city} customers are searching — is {name} showing up?",
        ],
        "hooks": [
            "I came across {name} while researching businesses in {city} — great operation, but I noticed you don't have a website yet.",
            "I was looking up local businesses in {city} and found {name}. Without a website, a lot of potential customers won't find you.",
            "I found {name} online but couldn't find a website. In {city}, people Google before they visit — you could be missing leads.",
            "I noticed {name} in {city} doesn't have a website. That means customers searching online go straight to competitors.",
            "I came across {name} and wanted to reach out — a simple website could make a big difference for your {city} customers.",
        ],
        "value": [
            "I build clean, affordable websites for local businesses — fast turnaround, mobile-friendly, and set up to show on Google.",
            "A simple site for {name} would make it easy for {city} customers to find you, see what you offer, and get in touch.",
            "I specialize in building websites for businesses that don't have one yet — simple, professional, and affordable.",
            "My websites are built specifically for local businesses in cities like {city}: mobile-first, Google-optimized, and quick to set up.",
        ],
        "cta": [
            "Would it make sense to jump on a quick call and see if a website is the right fit for {name}?",
            "Can I put together a free mock-up for {name}? No commitment needed.",
            "Happy to send some examples — just to give you an idea of what's possible.",
            "No pressure at all — just let me know if it's something worth exploring.",
        ],
    },
}

# ── Niche Matcher ───────────────────────────────────────────────────────────────

def detect_niche(row: dict) -> str:
    """Detect which niche profile to use based on business name and niche field."""
    name  = (row.get("business_name", "") or "").lower()
    niche = (row.get("niche", "") or "").lower()
    combined = f"{name} {niche}"

    for niche_key, profile in NICHE_PROFILES.items():
        if niche_key == "general":
            continue
        keywords = profile.get("keywords", [])
        for kw in keywords:
            if kw in combined:
                return niche_key

    return "general"


# ── Email Composer ──────────────────────────────────────────────────────────────

def compose_email(row: dict, used_subjects: set) -> Tuple[str, str]:
    """Generate a unique subject + body for a single lead row."""
    name  = row.get("business_name", "your business").strip()
    city  = (row.get("city_search", "your city") or "your city").strip()
    # Normalize city to just the city name (strip state abbreviation)
    city_display = city.split(",")[0].strip() if "," in city else city

    niche_key = detect_niche(row)
    profile   = NICHE_PROFILES[niche_key]

    def fill(template: str) -> str:
        return template.replace("{name}", name)\
                       .replace("{city}", city_display)\
                       .replace("{portfolio}", PORTFOLIO_LINK)

    # Pick a subject that hasn't been used yet in this batch
    subjects = profile["subjects"]
    random.shuffle(subjects)  # shuffle to add variety
    subject = ""
    for s in subjects:
        candidate = fill(s)
        if candidate not in used_subjects:
            subject = candidate
            used_subjects.add(candidate)
            break
    if not subject:
        # Fallback: just number it
        subject = fill(subjects[0]) + f" ({random.randint(10,99)})"
        used_subjects.add(subject)

    # Pick random components for the body
    if niche_key == "general":
        hook  = fill(random.choice(profile["hooks"]))
        value = fill(random.choice(profile["value"]))
        cta   = fill(random.choice(profile["cta"]))
    else:
        hook  = fill(random.choice(profile["hooks"]))
        value = fill(random.choice(profile["value"]))
        cta   = fill(random.choice(profile["cta"]))

    # Assemble body — short, conversational, 4-5 lines max
    body = (
        f"Hi there,\n\n"
        f"{hook}\n\n"
        f"{value}\n\n"
        f"{cta}\n\n"
        f"Best,\n"
        f"{SENDER_NAME}\n"
        f"{COMPANY_NAME} — {PORTFOLIO_LINK}"
    )

    return subject, body


# ── Main ────────────────────────────────────────────────────────────────────────

def run():
    if not os.path.exists(INPUT_CSV):
        print(f"[ERROR] Could not find: {INPUT_CSV}")
        print("  -> Run email_validator.py first to generate cleaned_leads.csv")
        return

    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows   = list(reader)

    if not rows:
        print("[ERROR] cleaned_leads.csv is empty - no leads to process.")
        return

    output_fields = [
        "to_email", "subject", "body",
        "business_name", "niche_detected", "city",
        "original_niche", "email_status"
    ]

    output_rows  = []
    used_subjects = set()
    niche_counts  = {}

    for row in rows:
        email = row.get("validated_email", "").strip()
        if not email or email.upper() in ("N/A", "NONE", ""):
            continue

        subject, body = compose_email(row, used_subjects)

        niche_detected = detect_niche(row)
        niche_counts[niche_detected] = niche_counts.get(niche_detected, 0) + 1

        output_rows.append({
            "to_email":       email,
            "subject":        subject,
            "body":           body,
            "business_name":  row.get("business_name", ""),
            "niche_detected": niche_detected,
            "city":           row.get("city_search", ""),
            "original_niche": row.get("niche", ""),
            "email_status":   row.get("email_status", ""),
        })

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_fields)
        writer.writeheader()
        writer.writerows(output_rows)

    # ── Print Report ──
    print("\n" + "="*60)
    print("  SiteForge Email Generator - Report")
    print("="*60)
    print(f"  Total emails generated : {len(output_rows)}")
    print(f"  Unique subjects used   : {len(used_subjects)}")
    print(f"  Output file            : outreach_emails.csv")
    print("-"*60)
    print("  Breakdown by niche:")
    for niche, count in sorted(niche_counts.items(), key=lambda x: -x[1]):
        print(f"    {niche:<20} : {count} emails")
    print("="*60)

    # ── Show sample emails ──
    print(f"\n  Sample emails (first 5):\n")
    for r in output_rows[:5]:
        print(f"  --- {r['business_name']} ---------------------------------")
        print(f"  To      : {r['to_email']}")
        print(f"  Subject : {r['subject']}")
        print(f"  Body preview:\n")
        for line in r["body"].split("\n")[:5]:
            print(f"    {line}")
        print()


if __name__ == "__main__":
    run()
