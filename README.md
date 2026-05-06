# SiteForge Lead Command Center 🚀

An exceptionally sleek, high-performance, full-stack lead generation and outreach management dashboard designed for high-conversion local business acquisition.

---

## 🌟 Key Features

* **Real-World Lead Database**: Holds 250 fully parsed and verified local business leads extracted directly from state-level Excel digital audit sheets.
* **Smart Niche Filtering**: Dynamically filter leads by targeted state niches (Georgia, Kentucky, Mississippi, Vermont, West Virginia).
* **Smart Adaptive Outreach System**:
  * **Email Pitch (Send Pitch)**: Triggers personalized HTML/text pitch drafts in Gmail for leads with verified email addresses.
  * **WhatsApp Pitch**: Automatically cleans telephone formatting and pre-populates a highly-optimized pitch chat link (`https://wa.me/...`) for leads with only a telephone number.
  * **Facebook Page Pitch**: Seamlessly falls back to direct profile page pitching or fallback search routes to eliminate 404 errors.
* **Chrome Multi-Account Syncing**: Dynamic template switching based on active operator Chrome Profile configurations.
* **Real-time Analytics**: Displays live conversion stats, hot/warm badges, and quality scoring (1-10 scale based on digital footprint health).

---

## 🛠️ Technology Stack

* **Frontend**: Vanilla HTML5, CSS3 Custom Tokens, CSS Grid, Lucide Icons, Vanilla JavaScript.
* **Backend**: Flask (Python 3), CORS, JSON database pipelines.
* **Pipelines**: Automation script using `openpyxl` to extract, sanitize, and deduplicate leads from raw Excel workbooks.

---

## 🚀 Quick Start

### 1. Set Up Python Virtual Environment
```powershell
# Create venv
python -m venv .venv

# Activate venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install Flask flask-cors openpyxl
```

### 2. Import Leads from Audit Sheet
```powershell
.venv\Scripts\python leads/import_audit_leads.py
```

### 3. Launch Flask Backend
```powershell
.venv\Scripts\python backend/app.py
```

### 4. Access the Dashboard
Open your browser and navigate to:
* **Login URL**: `http://127.0.0.1:5000/`
* **Dashboard URL**: `http://127.0.0.1:5000/dashboard`

---

## 🔐 Credentials
* **Admin**: `Inventormini` / `dinu101`
