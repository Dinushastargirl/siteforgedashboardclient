// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTheme();
    initClock();
    fetchLeads();
    initChromeSettings();
    initEventListeners();
    lucide.createIcons();
});

// Auth Logic
function initAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('user-display-name').textContent = user.name;
        document.getElementById('user-role-badge').textContent = user.role;
        document.getElementById('user-initial').textContent = user.name.charAt(0);
        
        // Hide settings tab for non-admins
        if (user.role !== 'admin') {
            const settingsTab = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('Settings'));
            if (settingsTab) settingsTab.style.display = 'none';
        }
    }
}

// Theme Logic
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // Set initial icon state based on body class
    const isDark = document.body.classList.contains('dark-theme');
    themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    lucide.createIcons();
    
    themeToggle.addEventListener('click', () => {
        const isCurrentlyDark = document.body.classList.contains('dark-theme');
        if (isCurrentlyDark) {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            themeIcon.setAttribute('data-lucide', 'sun');
        } else {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            themeIcon.setAttribute('data-lucide', 'moon');
        }
        lucide.createIcons();
    });
}

// Real-time Clock Logic
function initClock() {
    const clockEl = document.getElementById('realtime-clock');
    
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const strTime = String(hours).padStart(2, '0') + ':' + minutes + ':' + seconds + ' ' + ampm;
        
        clockEl.textContent = strTime;
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

let allLeadsCache = []; // Global cache for all loaded database leads
let currentCountry = 'All'; // Default active country filter
let currentNiche = 'All'; // Default active niche
let currentContactMethod = 'All'; // Default active contact method filter

// Filter global cache by the currently selected country, niche, and contact method
function getLeadsByCurrentNiche() {
    let filtered = allLeadsCache;
    
    if (currentCountry !== 'All') {
        filtered = filtered.filter(lead => lead.country === currentCountry);
    }
    
    if (currentNiche !== 'All') {
        filtered = filtered.filter(lead => lead.niche === currentNiche);
    }
    
    if (currentContactMethod !== 'All') {
        filtered = filtered.filter(lead => {
            const country = lead.country || 'USA';
            const email = (lead.validated_email || lead.email || '').toLowerCase();
            const phone = (lead.validated_phone || lead.phone || '').toLowerCase();
            const hasEmail = email !== 'n/a' && email !== '' && email !== 'none';
            const hasPhone = phone !== 'n/a' && phone !== '' && phone !== 'none';
            
            // Checking if country supports WhatsApp
            const hasWhatsApp = hasPhone && ['Nigeria', 'Kenya', 'Ghana', 'India', 'Brazil', 'South Africa', 'Malaysia', 'Saudi Arabia', 'Turkey', 'Mexico', 'UAE', 'Indonesia', 'Ethiopia', 'UK', 'Canada', 'Sweden'].includes(country);
            
            if (currentContactMethod === 'Email') return hasEmail;
            if (currentContactMethod === 'WhatsApp') return hasWhatsApp;
            return true;
        });
    }
    
    return filtered;
}

// Fetch Leads Data
async function fetchLeads() {
    const grid = document.getElementById('lead-grid');
    grid.innerHTML = '<div class="lead-card" style="grid-column: 1/-1; text-align: center; padding: 4rem;">Loading amazing leads...</div>';
    
    try {
        let apiUrl = '/api/leads';
        if (window.location.protocol === 'file:' || 
           ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000')) {
            apiUrl = 'http://127.0.0.1:5000/api/leads';
        }
        const response = await fetch(apiUrl);
        const leads = await response.json();
        allLeadsCache = leads; // Store all leads in global cache
        
        const nicheLeads = getLeadsByCurrentNiche();
        renderLeads(nicheLeads);
        renderDirectoryLeads(nicheLeads); // Populate SOLID Leads Directory
        updateStats(nicheLeads);
        renderOutreachLogs(); // Render initial outreach logs
    } catch (error) {
        grid.innerHTML = '<div class="lead-card" style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--hot-color);">Failed to load leads from the server.</div>';
    }
}

// Helper to calculate exact quality score out of 10 based on rules
function calculateScore(lead) {
    let score = 0;
    const country = lead.country || 'USA';
    const email = lead.validated_email || lead.email || '';
    const hasEmail = email !== 'N/A' && email !== '' && email !== 'None';
    
    const phone = lead.validated_phone || lead.phone || '';
    const hasPhone = phone !== 'N/A' && phone !== '' && phone !== 'None';
    
    const hasWhatsApp = hasPhone && ['Nigeria', 'Kenya', 'Ghana', 'India', 'Brazil', 'South Africa', 'Malaysia', 'Saudi Arabia', 'Turkey', 'Mexico', 'UAE', 'Indonesia', 'Ethiopia', 'UK', 'Canada', 'Sweden'].includes(country);
    const hasActiveFb = lead.facebook_active === true;
    const likes = parseInt(lead.facebook_likes || 0);
    
    if (hasWhatsApp) score += 3;
    if (hasEmail) score += 2;
    if (hasActiveFb) score += 2;
    if (hasPhone) score += 2;
    if (likes >= 50) score += 1;
    
    return score;
}

// Helper to get localized pre-filled WhatsApp templates
function getWhatsAppMsg(country, name) {
    if (country === 'Nigeria') {
        return `Hi ${name}! I came across ${name} on Facebook. You're doing great work — but a lot of your customers are searching Google and can't find you because you don't have a website yet. I build affordable professional websites for Nigerian businesses. Can I send you a free sample of what yours could look like? 🙏`;
    } else if (country === 'Philippines') {
        return `Hi ${name}! I saw ${name} on Facebook — love what you do! I noticed you don't have your own website yet. A lot of customers search Google first before messaging on Facebook, and you're missing them. I build websites for local Filipino businesses at very affordable rates. Want me to show you a free mock-up? 😊`;
    } else if (country === 'Kenya') {
        return `Hi ${name}! I found ${name} on Facebook — really impressive work. I help local Kenyan businesses get found on Google by building them a professional website. Right now your customers can only find you on Facebook, but Google is where new customers look first. Can I send you a free example of what your website could look like?`;
    } else if (country === 'Ghana') {
        return `Hi ${name}! I came across ${name} on Facebook. Your work looks amazing! I specialise in building websites for small businesses in Ghana so customers can find you on Google too. I'd love to show you a free mock-up — no commitment needed. Interested? 😊`;
    } else if (country === 'India') {
        return `Hi ${name}! I found ${name} on Facebook. Very impressive! I help small Indian businesses build affordable websites so customers can find them on Google. Right now most people searching for your service online can't find you. I'd love to send you a free website sample — shall I?`;
    } else if (country === 'Brazil') {
        return `Oi ${name}! Encontrei o ${name} no Facebook/Instagram — adorei! Percebi que você ainda não tem um site próprio. Muitos clientes procuram no Google e não te encontram. Eu crio sites profissionais para pequenos negócios a preços acessíveis. Posso te mandar um exemplo grátis? 😊`;
    } else if (country === 'South Africa') {
        return `Hi ${name}! I came across ${name} on Facebook — great work! I build professional websites for South African small businesses so customers can find you on Google. I'd love to put together a free mock-up for you to see what it could look like. Want me to send it over?`;
    } else if (country === 'Malaysia') {
        return `Hi ${name}! I saw ${name} on Facebook — looks great! I help local Malaysian businesses build websites so customers can find them on Google. Many people search online before messaging on WhatsApp — you could be getting a lot more clients. Can I show you a free sample site?`;
    } else if (country === 'Australia') {
        return `Hi ${name}, I came across ${name} on Facebook and love what you're doing. I noticed you don't have your own website yet — a lot of customers in Australia Google services before reaching out and you might be missing them. I build clean professional websites for local businesses. Happy to put together a free mock-up if you're interested?`;
    } else if (country === 'Saudi Arabia') {
        return `Hi ${name}, I found ${name} on Instagram. Great work! I help businesses in Saudi Arabia build professional websites so new customers can find them on Google. Many people search Google before contacting on WhatsApp. I'd be happy to show you a free sample — would that be useful?`;
    } else if (country === 'Turkey') {
        return `Merhaba ${name}! ${name}'i Instagram/Facebook'ta gördüm — çok güzel! Henüz bir web siteniz olmadığını fark ettim. Google'da arayan müşterileriniz sizi bulamıyor. Türk küçük işletmelere uygun fiyatlı web siteleri yapıyorum. Ücretsiz bir örnek gönderebilir miyim? 😊`;
    } else if (country === 'Mexico') {
        return `Hola ${name}! Vi ${name} en Facebook — me encanta lo que haces. Noté que todavía no tienes un sitio web propio. Muchos clientes buscan en Google antes de escribir por WhatsApp y te están perdiendo. Creo sitios web profesionales para negocios locales a precios accesibles. ¿Te mando un ejemplo gratis? 😊`;
    } else if (country === 'UK' || country === 'Canada' || country === 'Sweden' || country === 'USA') {
        return `Hi ${name}! I came across ${name} on Facebook and love what you're doing. I noticed you don't have a website yet — I build affordable sites for local businesses and I'd love to show you a free mock-up. Interested? 😊`;
    } else if (country === 'UAE') {
        return `Hi ${name}, I found ${name} on Instagram/Facebook. I specialise in building websites for businesses in the UAE. Many of your customers are searching Google and can't find you — I'd love to help. Can I show you a free sample?`;
    } else if (country === 'Indonesia') {
        return `Halo ${name}! Saya lihat ${name} di Facebook. Saya bantu bisnis lokal buat website profesional dengan harga terjangkau. Boleh saya kirim contoh gratis?`;
    } else if (country === 'Ethiopia') {
        return `Hello ${name}, I found ${name} on Facebook. I build affordable websites for local businesses. Many customers search Google and can't find you — I'd love to help. Can I show you a free example?`;
    }
    return `Hi ${name}! I noticed your business doesn't have a website yet — I build affordable websites for local businesses. Can I show you a free mockup?`;
}

// Handlers for logging non-email contacts
window.recordWhatsAppAndOpen = function(name, link, country) {
    const rawMsg = getWhatsAppMsg(country, name);
    logOutreachEvent(name, country, rawMsg, 'WhatsApp');
    window.open(link, '_blank');
};

window.recordFBAndOpen = function(name, link, country) {
    logOutreachEvent(name, country, `Opened Facebook Page to Pitch: ${link}`, 'Facebook DM');
    window.open(link, '_blank');
};

// Render Leads
function renderLeads(leads) {
    const grid = document.getElementById('lead-grid');
    grid.innerHTML = '';
    
    if (leads.length === 0) {
        grid.innerHTML = '<div class="lead-card" style="grid-column: 1/-1; text-align: center; padding: 4rem;">No leads found.</div>';
        return;
    }
    
    leads.forEach(lead => {
        const name = lead.business_name || lead.name || 'Unknown Business';
        const phone = lead.validated_phone || lead.phone || 'N/A';
        const website = lead.website_url || lead.website || 'None';
        const fb = lead.facebook_url || 'None';
        const email = lead.validated_email || 'N/A';
        const country = lead.country || 'USA';
        
        // Dynamic Quality Score Calculation
        const score = calculateScore(lead);
        const savedOverrides = JSON.parse(localStorage.getItem('lead_status_overrides') || '{}');
        const statusLabel = savedOverrides[name] || (score >= 7 ? 'HOT' : (score >= 4 ? 'WARM' : 'COLD'));
        const badgeColorClass = statusLabel === 'HOT' ? 'status-hot' : (statusLabel === 'WARM' ? 'status-warm' : 'status-cold');
        
        const hasEmail = email !== 'N/A' && email !== '' && email !== 'None';
        const hasPhone = phone !== 'N/A' && phone !== '' && phone !== 'None';
        const hasFb = fb !== 'None' && fb !== '' && !fb.includes('search/top');
        const hasWhatsApp = hasPhone && ['Nigeria', 'Kenya', 'Ghana', 'India', 'Brazil', 'South Africa', 'Malaysia', 'Saudi Arabia', 'Turkey', 'Mexico', 'UAE', 'Indonesia', 'Ethiopia', 'UK', 'Canada', 'Sweden'].includes(country);
        
        // Generate Contact badges HTML
        let badgesHTML = '<div class="contact-badges-container">';
        if (hasWhatsApp) {
            badgesHTML += `<span class="contact-badge badge-whatsapp" title="WhatsApp available"><i data-lucide="message-square"></i> WhatsApp</span>`;
        }
        if (hasFb) {
            badgesHTML += `<span class="contact-badge badge-facebook" title="Facebook DM available"><i data-lucide="facebook"></i> Facebook DM</span>`;
        }
        if (hasEmail) {
            badgesHTML += `<span class="contact-badge badge-email" title="Email available"><i data-lucide="mail"></i> Email</span>`;
        }
        if (hasPhone) {
            badgesHTML += `<span class="contact-badge badge-phone" title="Phone calls available"><i data-lucide="phone"></i> Phone</span>`;
        }
        badgesHTML += '</div>';

        // Render Action buttons side-by-side if multiple are available
        let actionButtonsHTML = '';
        
        if (['Philippines', 'Australia'].includes(country) && hasFb) {
            let fbDmLink = fb;
            const match = fb.match(/facebook\.com\/([^/?#]+)/);
            if (match && match[1]) {
                fbDmLink = `https://www.facebook.com/messages/t/${match[1]}`;
            }
            actionButtonsHTML += `
                <button class="btn btn-primary" onclick="recordFBAndOpen('${name.replace(/'/g, "\\'")}', '${fbDmLink}', '${country}')" style="background: #3b82f6; border-color: #3b82f6; flex: 1;">
                    <i data-lucide="facebook"></i>
                    Facebook DM
                </button>
            `;
            if (hasEmail) {
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}')" style="flex: 1;" title="Email Pitch">
                        <i data-lucide="send"></i>
                        Email
                    </button>
                `;
            } else if (hasWhatsApp) {
                const phoneDigits = phone.replace(/\D/g, '');
                const rawMsg = getWhatsAppMsg(country, name);
                const waMsg = encodeURIComponent(rawMsg);
                const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="recordWhatsAppAndOpen('${name.replace(/'/g, "\\'")}', '${waLink}', '${country}')" style="background: #22c55e; border-color: #22c55e; flex: 1;" title="WhatsApp Pitch">
                        <i data-lucide="message-square"></i>
                        WhatsApp
                    </button>
                `;
            }
        } else {
            if (hasWhatsApp) {
                const phoneDigits = phone.replace(/\D/g, '');
                const rawMsg = getWhatsAppMsg(country, name);
                const waMsg = encodeURIComponent(rawMsg);
                const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="recordWhatsAppAndOpen('${name.replace(/'/g, "\\'")}', '${waLink}', '${country}')" style="background: #22c55e; border-color: #22c55e; flex: 1;">
                        <i data-lucide="message-square"></i>
                        WhatsApp
                    </button>
                `;
                if (hasEmail) {
                    actionButtonsHTML += `
                        <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}')" style="flex: 1;" title="Email Pitch">
                            <i data-lucide="send"></i>
                            Email
                        </button>
                    `;
                }
            } else if (hasEmail) {
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}')" style="flex: 1;">
                        <i data-lucide="send"></i>
                        Email Pitch
                    </button>
                `;
                if (hasFb) {
                    actionButtonsHTML += `
                        <button class="btn btn-primary" onclick="recordFBAndOpen('${name.replace(/'/g, "\\'")}', '${fb}', '${country}')" style="background: #3b82f6; border-color: #3b82f6; flex: 1;" title="Facebook Pitch">
                            <i data-lucide="facebook"></i>
                            FB DM
                        </button>
                    `;
                }
            } else if (hasFb) {
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="recordFBAndOpen('${name.replace(/'/g, "\\'")}', '${fb}', '${country}')" style="background: #3b82f6; border-color: #3b82f6; flex: 1;">
                        <i data-lucide="facebook"></i>
                        Pitch on FB
                    </button>
                `;
            }
        }
        if (actionButtonsHTML === '') {
            actionButtonsHTML = `
                <button class="btn btn-primary" disabled style="background: var(--border-color); border-color: var(--border-color); cursor: not-allowed; color: var(--text-secondary); width: 100%;">
                    <i data-lucide="slash"></i>
                    No Contact
                </button>
            `;
        }
        
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.innerHTML = `
            <div class="lead-header">
                <div>
                    <h3 class="lead-title">${name}</h3>
                    <div style="color: var(--text-secondary); font-size: 0.875rem;">
                        <i data-lucide="map-pin" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> ${lead.city_search || country}
                    </div>
                </div>
                <span class="status-badge ${badgeColorClass}">${statusLabel}</span>
            </div>
            
            <div class="lead-details">
                <div class="detail-row">
                    <span class="detail-label">Website</span>
                    <span class="detail-value">${website !== 'None' ? `<a href="${website}" target="_blank" style="color:var(--accent-color)">Link</a>` : '<span style="color:var(--hot-color)">No Website</span>'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Facebook</span>
                    <span class="detail-value">${fb !== 'None' && fb ? `<a href="${fb}" target="_blank" style="color:var(--accent-color)">View Page</a>` : 'Not Found'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${email}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Quality Score</span>
                    <span class="detail-value" style="font-weight:bold; color: ${score <= 3 ? 'var(--hot-color)' : (score >= 7 ? '#10b981' : 'var(--text-primary)')}">${score}/10</span>
                </div>
                <div style="margin-top: 0.75rem;">
                    ${badgesHTML}
                </div>
            </div>
            
            <div class="lead-actions" style="display: flex; gap: 0.5rem; width: 100%;">
                ${actionButtonsHTML}
            </div>
        `;
        grid.appendChild(card);
    });
    
    lucide.createIcons();
}

// Update Stats
function updateStats(leads) {
    document.getElementById('stat-total').textContent = leads.length;
    
    const hotLeads = leads.filter(l => calculateScore(l) >= 7).length;
    document.getElementById('stat-hot').textContent = hotLeads;
    
    // Compute actual dynamic average score
    const avgScore = leads.length > 0 
        ? (leads.reduce((sum, l) => sum + calculateScore(l), 0) / leads.length).toFixed(1)
        : '0.0';
    document.getElementById('stat-avg').textContent = `${avgScore}/10`;
}

// Global variable for current email text and lead metadata
let currentEmailText = '';
let currentOutreachLeadName = '';
let currentOutreachLeadEmail = '';

// Open Outreach Modal
window.openOutreach = function(name, email) {
    currentOutreachLeadName = name;
    currentOutreachLeadEmail = email;
    
    const modal = document.getElementById('outreach-modal');
    document.getElementById('modal-subtitle').textContent = `Drafting pitch for ${name} (${email})`;
    
    const activeProfile = getActiveSyncProfile();
    const signature = activeProfile.signature;
    
    let nicheLabel = currentNiche.toLowerCase();
    if (nicheLabel === 'all') {
        nicheLabel = 'trade services';
    } else if (nicheLabel === 'hvac / ac repair') {
        nicheLabel = 'HVAC & AC repair';
    } else if (nicheLabel === 'solar installers') {
        nicheLabel = 'solar installation';
    } else if (nicheLabel === 'roofing contractors') {
        nicheLabel = 'roofing';
    }
    
    const templates = [
        `Hi ${name} Team,\n\nI noticed your business doesn't have an optimized website (or it's currently hard to find on mobile devices).\n\nSince most customers searching for ${nicheLabel} in your area are doing so on their phones, a modern, fast-loading website can instantly increase your bookings.\n\nI build high-converting websites specifically for ${nicheLabel} businesses. Would you be open to a quick chat to see how we could help you capture those missed leads?\n\nBest,\n${signature}`,
        
        `Hello ${name},\n\nI was looking for ${nicheLabel} services in the area and couldn't easily find a dedicated website for your business.\n\nMany of your potential customers use their smartphones to make quick decisions, and a professional digital presence is key to winning their trust.\n\nWe specialize in creating premium, mobile-friendly sites for ${nicheLabel} professionals. Let me know if you have a few minutes this week to discuss how we can upgrade your online footprint!\n\nCheers,\n${signature}`,
        
        `Hi there,\n\nMy name is ${signature} and I help ${nicheLabel} businesses scale up by improving their web presence.\n\nI came across ${name} recently and noticed you could benefit from a highly optimized, modern website. Having a reliable site acts as a 24/7 sales rep for your services.\n\nI'd love to share some quick ideas on how a new site could bring in more leads. Are you open to a brief chat?\n\nThanks,\n${signature}`
    ];
    
    // Pick a template deterministically based on business name length so it's consistent for the same lead but varies across leads
    const templateIndex = name.length % templates.length;
    currentEmailText = templates[templateIndex];
    
    document.getElementById('email-body').innerHTML = currentEmailText.replace(/\n/g, '<br>');
    modal.style.display = 'flex';
};

// Event Listeners
function initEventListeners() {
    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        
        if (window.location.protocol === 'file:' || 
           ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000')) {
            window.location.href = 'login.html';
        } else {
            window.location.href = '/';
        }
    });

    // Close Modals
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('outreach-modal').style.display = 'none';
    });

    // Copy Email
    document.getElementById('btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(currentEmailText).then(() => {
            const btn = document.getElementById('btn-copy');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> Copied!';
            lucide.createIcons();
            
            // Record in Outreach Logs
            logOutreachEvent(currentOutreachLeadName, currentOutreachLeadEmail, 'Copied Pitch To Clipboard', 'Copied');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                lucide.createIcons();
            }, 2000);
        });
    });

    // Open Gmail Draft
    const btnGmail = document.getElementById('btn-gmail');
    if (btnGmail) {
        btnGmail.addEventListener('click', () => {
            let nicheLabel = currentNiche.toLowerCase();
            if (nicheLabel === 'all') {
                nicheLabel = 'trade services';
            } else if (nicheLabel === 'hvac / ac repair') {
                nicheLabel = 'HVAC & AC repair';
            } else if (nicheLabel === 'solar installers') {
                nicheLabel = 'solar installation';
            } else if (nicheLabel === 'roofing contractors') {
                nicheLabel = 'roofing';
            }
            
            const subjectInput = document.getElementById('setting-subject-input');
            const defaultSubject = `Need a new website for your ${nicheLabel} business?`;
            const subjectText = subjectInput ? subjectInput.value.replace("plumbing", nicheLabel) : defaultSubject;
            
            const subject = encodeURIComponent(subjectText);
            const body = encodeURIComponent(currentEmailText);
            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${currentOutreachLeadEmail}&su=${subject}&body=${body}`, '_blank');
            
            // Record in Outreach Logs
            logOutreachEvent(currentOutreachLeadName, currentOutreachLeadEmail, 'Opened Gmail Draft', 'Gmail');
        });
    }
    
    // Global Country Select Dropdown
    const countrySelect = document.getElementById('global-country-select');
    if (countrySelect) {
        countrySelect.addEventListener('change', () => {
            currentCountry = countrySelect.value;
            
            // Re-render everything with the new filtered leads
            const nicheLeads = getLeadsByCurrentNiche();
            renderLeads(nicheLeads);
            updateStats(nicheLeads);
            applyDirectoryFilters();
        });
    }

    // Global Niche Select Dropdown
    const nicheSelect = document.getElementById('global-niche-select');
    if (nicheSelect) {
        nicheSelect.addEventListener('change', () => {
            currentNiche = nicheSelect.value;
            
            // Re-render everything with the new niche leads
            const nicheLeads = getLeadsByCurrentNiche();
            renderLeads(nicheLeads);
            updateStats(nicheLeads);
            applyDirectoryFilters();
        });
    }

    // Global Contact Method Select Dropdown
    const contactSelect = document.getElementById('global-contact-select');
    if (contactSelect) {
        contactSelect.addEventListener('change', () => {
            currentContactMethod = contactSelect.value;
            
            // Re-render everything with the new filtered leads
            const nicheLeads = getLeadsByCurrentNiche();
            renderLeads(nicheLeads);
            updateStats(nicheLeads);
            applyDirectoryFilters();
        });
    }
    
    // Directory Search Input
    const directorySearch = document.getElementById('directory-search-input');
    if (directorySearch) {
        directorySearch.addEventListener('input', applyDirectoryFilters);
    }
    
    // Toggle Filter Dropdown
    const btnFilterToggle = document.getElementById('btn-directory-filter');
    const filterDropdown = document.getElementById('directory-filter-dropdown');
    if (btnFilterToggle && filterDropdown) {
        btnFilterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            filterDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!filterDropdown.contains(e.target) && e.target !== btnFilterToggle) {
                filterDropdown.classList.remove('show');
            }
        });
    }
    
    // Dropdown input filter changes
    const filterInputs = [
        'filter-status-hot',
        'filter-status-warm',
        'filter-status-cold',
        'filter-quality-all',
        'filter-quality-high',
        'filter-quality-good'
    ];
    filterInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', applyDirectoryFilters);
        }
    });
    
    // Clear logs history
    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
        btnClearLogs.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your entire outreach history logs?')) {
                localStorage.removeItem('outreach_logs');
                renderOutreachLogs();
            }
        });
    }
    
    // Tab Switching Logic
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    
    // Sidebar Hamburger Menu Toggle elements
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburgerBtn = document.getElementById('btn-hamburger');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    
    function closeMobileSidebar() {
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
    
    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeMobileSidebar);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeMobileSidebar);
    }
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.getAttribute('data-view');
            if (!targetView) return;
            
            // Check admin permission for settings
            if (targetView === 'settings') {
                const user = JSON.parse(localStorage.getItem('user'));
                if (!user || user.role !== 'admin') {
                    alert('Access Denied. Admin privileges required.');
                    return;
                }
            }
            
            // Toggle active nav class
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle active view section
            viewSections.forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active');
            });
            
            const targetSection = document.getElementById(`view-${targetView}`);
            if (targetSection) {
                targetSection.style.display = 'block';
                targetSection.classList.add('active');
                
                // If opening log or directory section, force a render update
                if (targetView === 'leads') {
                    applyDirectoryFilters();
                } else if (targetView === 'logs') {
                    renderOutreachLogs();
                }
            }
            
            // Auto close mobile sidebar when tab is clicked
            closeMobileSidebar();
        });
    });
    
}

// Redesigned Chrome Settings Logic
const CHROME_PROFILES = [
    {
        email: 'dinushapushparajah@gmail.com',
        name: 'Dinusha Pushparajah',
        avatar: 'D',
        signature: 'Dinusha Pushparajah',
        color: '#3b82f6'
    },
    {
        email: 'dinudinu4927@gmail.com',
        name: 'Dinusha (Personal)',
        avatar: 'D',
        signature: 'Dinusha',
        color: '#10b981'
    },
    {
        email: 'vorkglobal@gmail.com',
        name: 'vorkglobal',
        avatar: 'V',
        signature: 'Vork Global Team',
        color: '#8b5cf6'
    },
    {
        email: 'aurumstudiocctv@gmail.com',
        name: 'Aurumstudio',
        avatar: 'A',
        signature: 'Aurum Studio CCTV Team',
        color: '#f59e0b'
    },
    {
        email: 'littleheartbaker0010@gmail.com',
        name: 'Littleheart',
        avatar: 'L',
        signature: 'Little Heart Baker Team',
        color: '#ec4899'
    }
];

function getActiveSyncProfile() {
    const savedEmail = localStorage.getItem('active_sync_profile_email');
    const profile = CHROME_PROFILES.find(p => p.email === savedEmail);
    return profile || CHROME_PROFILES[0];
}

function initChromeSettings() {
    const searchInput = document.getElementById('chrome-settings-search');
    const tabItems = document.querySelectorAll('.chrome-sidebar-item');
    const settingsGroups = document.querySelectorAll('.chrome-settings-group');
    const syncToggle = document.getElementById('btn-sync-toggle');
    const saveBtn = document.getElementById('btn-save-chrome-settings');
    const themeRow = document.getElementById('row-theme-change');
    const profileSelect = document.getElementById('setting-profile-select');
    
    // 1. Profile Synchronization matching Dinusha Pushparajah
    function updateProfileUI(profile) {
        const profileName = document.getElementById('chrome-profile-name');
        const profileEmail = document.getElementById('chrome-profile-email');
        const profileAvatar = document.getElementById('chrome-profile-avatar');
        
        if (profileName && profileEmail && profileAvatar) {
            profileName.textContent = profile.name;
            profileEmail.textContent = profile.email;
            profileAvatar.textContent = profile.avatar;
            profileAvatar.style.background = profile.color;
        }
        
        if (profileSelect) {
            profileSelect.value = profile.email;
        }
    }
    
    let activeProfile = getActiveSyncProfile();
    updateProfileUI(activeProfile);
    
    if (profileSelect) {
        profileSelect.addEventListener('change', () => {
            const selectedEmail = profileSelect.value;
            const chosen = CHROME_PROFILES.find(p => p.email === selectedEmail);
            if (chosen) {
                localStorage.setItem('active_sync_profile_email', chosen.email);
                updateProfileUI(chosen);
                
                // If sync toggle text is Turn off (meaning sync is active), update the status text email
                const syncToggleBtn = document.getElementById('btn-sync-toggle');
                if (syncToggleBtn && syncToggleBtn.textContent === 'Turn off') {
                    const syncStatusText = document.querySelector('.chrome-profile-sync');
                    if (syncStatusText) {
                        syncStatusText.innerHTML = `<i data-lucide="check-circle-2" class="chrome-sync-status-icon" style="color:#10b981"></i> Syncing to <span id="chrome-profile-email">${chosen.email}</span>`;
                        lucide.createIcons();
                    }
                }
            }
        });
    }
    
    // 2. Tab Switching Logic for Sub-Sidebar
    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-settings-tab');
            
            // Toggle active tab class
            tabItems.forEach(tab => tab.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle visibility of setting groups
            settingsGroups.forEach(group => {
                group.style.display = 'none';
            });
            
            const activeGroup = document.getElementById(`settings-group-${tabId}`);
            if (activeGroup) {
                activeGroup.style.display = 'block';
            }
        });
    });
    
    // 3. Live Settings Search Functionality
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            
            // If empty search, reset tabs to original state
            if (query === '') {
                const activeTab = document.querySelector('.chrome-sidebar-item.active');
                const activeTabId = activeTab ? activeTab.getAttribute('data-settings-tab') : 'you';
                
                settingsGroups.forEach(group => {
                    const groupId = group.id.replace('settings-group-', '');
                    group.style.display = (groupId === activeTabId) ? 'block' : 'none';
                    
                    // Reset elements within the group
                    group.querySelectorAll('.chrome-row, .chrome-form-control').forEach(el => {
                        el.style.display = '';
                    });
                });
                return;
            }
            
            // Search mode: Show all groups but filter individual rows/controls inside them
            settingsGroups.forEach(group => {
                let hasMatch = false;
                
                // Check setting rows
                const rows = group.querySelectorAll('.chrome-row');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    if (text.includes(query)) {
                        row.style.display = '';
                        hasMatch = true;
                    } else {
                        row.style.display = 'none';
                    }
                });
                
                // Check form controls (inputs)
                const controls = group.querySelectorAll('.chrome-form-control');
                controls.forEach(control => {
                    const text = control.textContent.toLowerCase();
                    if (text.includes(query)) {
                        control.style.display = '';
                        hasMatch = true;
                    } else {
                        control.style.display = 'none';
                    }
                });
                
                // Show group if it contains a matching setting, else hide it
                if (hasMatch) {
                    group.style.display = 'block';
                } else {
                    group.style.display = 'none';
                }
            });
        });
    }
    
    // 4. Sync Connection Toggle
    if (syncToggle) {
        syncToggle.addEventListener('click', () => {
            const isSyncing = syncToggle.textContent === 'Turn off';
            const syncIcon = document.querySelector('.chrome-sync-status-icon');
            const syncStatusText = document.querySelector('.chrome-profile-sync');
            const profileEmail = document.getElementById('chrome-profile-email').textContent;
            
            if (isSyncing) {
                syncToggle.textContent = 'Turn on';
                syncToggle.classList.replace('btn-chrome-outline', 'btn-primary');
                syncToggle.style.borderRadius = '100px';
                syncToggle.style.padding = '0.5rem 1.25rem';
                syncIcon.style.color = '#ef4444';
                syncIcon.setAttribute('data-lucide', 'x-circle');
                syncStatusText.innerHTML = `<i data-lucide="x-circle" class="chrome-sync-status-icon" style="color:#ef4444"></i> Sync is paused for ${profileEmail}`;
            } else {
                syncToggle.textContent = 'Turn off';
                syncToggle.className = 'btn-chrome-outline';
                syncToggle.style = '';
                syncIcon.style.color = '#10b981';
                syncIcon.setAttribute('data-lucide', 'check-circle-2');
                syncStatusText.innerHTML = `<i data-lucide="check-circle-2" class="chrome-sync-status-icon" style="color:#10b981"></i> Syncing to <span id="chrome-profile-email">${profileEmail}</span>`;
            }
            lucide.createIcons();
        });
    }
    
    // 5. Save Changes for Outreach Panel
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const subject = document.getElementById('setting-subject-input').value;
            const score = document.getElementById('setting-score-input').value;
            
            // Apply these configuration filters or store in memory (could also POST in real world)
            alert(`MyLeads configuration saved successfully!\n\nSubject: "${subject}"\nMin Quality Score: ${score}`);
        });
    }
    
    // 6. Interactive theme row click
    if (themeRow) {
        themeRow.addEventListener('click', () => {
            // Replicate theme toggle button functionality
            document.getElementById('theme-toggle').click();
        });
    }
}

// Render Leads in SOLID Directory Table
function renderDirectoryLeads(leads) {
    const tableBody = document.getElementById('directory-table-body');
    if (!tableBody) return;
    
    if (leads.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty-state">
                    <i data-lucide="users"></i>
                    <p style="margin-top: 0.5rem;">No matching SOLID leads found in the directory.</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    tableBody.innerHTML = leads.map(lead => {
        const name = lead.business_name || lead.name || 'Unknown Business';
        const phone = lead.validated_phone || lead.phone || 'N/A';
        const website = lead.website_url || lead.website || 'None';
        const fb = lead.facebook_url || 'None';
        const email = lead.validated_email || 'N/A';
        const country = lead.country || 'USA';
        
        const score = calculateScore(lead);
        const savedOverrides = JSON.parse(localStorage.getItem('lead_status_overrides') || '{}');
        const statusLabel = savedOverrides[name] || (score >= 7 ? 'HOT' : (score >= 4 ? 'WARM' : 'COLD'));
        const badgeColorClass = statusLabel === 'HOT' ? 'status-hot' : (statusLabel === 'WARM' ? 'status-warm' : 'status-cold');
        
        const hasEmail = email !== 'N/A' && email !== '' && email !== 'None';
        const hasPhone = phone !== 'N/A' && phone !== '' && phone !== 'None';
        const hasFb = fb !== 'None' && fb !== '' && !fb.includes('search/top');
        const hasWhatsApp = hasPhone && ['Nigeria', 'Kenya', 'Ghana', 'India', 'Brazil', 'South Africa', 'Malaysia', 'Saudi Arabia', 'Turkey', 'Mexico', 'UAE', 'Indonesia', 'Ethiopia', 'UK', 'Canada', 'Sweden'].includes(country);
        
        let directoryActionHTML = '';
        if (['Philippines', 'Australia'].includes(country) && hasFb) {
            let fbDmLink = fb;
            const match = fb.match(/facebook\.com\/([^/?#]+)/);
            if (match && match[1]) {
                fbDmLink = `https://www.facebook.com/messages/t/${match[1]}`;
            }
            directoryActionHTML = `
                <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: #3b82f6; border-color: #3b82f6;" onclick="recordFBAndOpen('${name.replace(/'/g, "\\'")}', '${fbDmLink}', '${country}')">
                    <i data-lucide="facebook" style="width:12px; height:12px;"></i>
                    Facebook DM
                </button>
            `;
        } else {
            if (hasWhatsApp) {
                const phoneDigits = phone.replace(/\D/g, '');
                const rawMsg = getWhatsAppMsg(country, name);
                const waMsg = encodeURIComponent(rawMsg);
                const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;
                directoryActionHTML = `
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: #22c55e; border-color: #22c55e;" onclick="recordWhatsAppAndOpen('${name.replace(/'/g, "\\'")}', '${waLink}', '${country}')">
                        <i data-lucide="message-square" style="width:12px; height:12px;"></i>
                        WhatsApp
                    </button>
                `;
            } else if (hasEmail) {
                directoryActionHTML = `
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}')">
                        <i data-lucide="send" style="width:12px; height:12px;"></i>
                        Send Pitch
                    </button>
                `;
            } else if (hasFb) {
                directoryActionHTML = `
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: #3b82f6; border-color: #3b82f6;" onclick="recordFBAndOpen('${name.replace(/'/g, "\\'")}', '${fb}', '${country}')">
                        <i data-lucide="facebook" style="width:12px; height:12px;"></i>
                        Pitch FB
                    </button>
                `;
            } else {
                directoryActionHTML = `
                    <button class="btn btn-primary" disabled style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: var(--border-color); border-color: var(--border-color); color: var(--text-secondary); cursor: not-allowed;">
                        <i data-lucide="slash" style="width:12px; height:12px;"></i>
                        No Contact
                    </button>
                `;
            }
        }
        
        return `
            <tr>
                <td style="font-weight: 600;">
                    ${name}
                    <span style="font-size:0.7rem; font-weight: normal; color:var(--text-secondary); background:var(--bg-card); border: 1px solid var(--border-color); padding: 0.05rem 0.25rem; border-radius: 4px; margin-left: 0.25rem;">${country}</span>
                </td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">${phone}</td>
                <td style="font-family: monospace; font-size: 0.8rem;">${email}</td>
                <td style="font-weight: bold; color: ${score <= 3 ? 'var(--hot-color)' : (score >= 7 ? '#10b981' : 'var(--text-primary)')}">${score}/10</td>
                <td>
                    <select class="lead-status-select ${badgeColorClass}" onchange="changeLeadStatus('${name.replace(/'/g, "\\'")}', this.value)">
                        <option value="HOT" class="status-hot" ${statusLabel === 'HOT' ? 'selected' : ''}>HOT</option>
                        <option value="WARM" class="status-warm" ${statusLabel === 'WARM' ? 'selected' : ''}>WARM</option>
                        <option value="COLD" class="status-cold" ${statusLabel === 'COLD' ? 'selected' : ''}>COLD</option>
                    </select>
                </td>
                <td style="text-align: right;">
                    ${directoryActionHTML}
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

// Apply Filters to SOLID Directory Table
function applyDirectoryFilters() {
    const query = document.getElementById('directory-search-input').value.toLowerCase().trim();
    
    const filterHot = document.getElementById('filter-status-hot').checked;
    const filterWarm = document.getElementById('filter-status-warm').checked;
    const filterCold = document.getElementById('filter-status-cold') ? document.getElementById('filter-status-cold').checked : true;
    
    const radioAll = document.getElementById('filter-quality-all').checked;
    const radioHigh = document.getElementById('filter-quality-high').checked; // Score 7+
    const radioGood = document.getElementById('filter-quality-good').checked; // Score 4-6
    
    const filteredLeads = getLeadsByCurrentNiche().filter(lead => {
        const name = (lead.business_name || lead.name || '').toLowerCase();
        const phone = (lead.validated_phone || lead.phone || '').toLowerCase();
        const email = (lead.validated_email || lead.email || '').toLowerCase();
        
        // 1. Search Query filter
        const matchesQuery = name.includes(query) || phone.includes(query) || email.includes(query);
        if (!matchesQuery) return false;
        
        // 2. Status filter
        const score = calculateScore(lead);
        const nameKey = lead.business_name || lead.name || '';
        const savedOverrides = JSON.parse(localStorage.getItem('lead_status_overrides') || '{}');
        const statusLabel = savedOverrides[nameKey] || (score >= 7 ? 'HOT' : (score >= 4 ? 'WARM' : 'COLD'));
        
        const isHot = statusLabel === 'HOT';
        const isWarm = statusLabel === 'WARM';
        const isCold = statusLabel === 'COLD';
        
        if (isHot && !filterHot) return false;
        if (isWarm && !filterWarm) return false;
        if (isCold && !filterCold) return false;
        
        // 3. Quality score filter
        if (radioHigh && score < 7) return false;
        if (radioGood && (score < 4 || score >= 7)) return false;
        
        return true;
    });
    
    renderDirectoryLeads(filteredLeads);
}

// Helper to get follow-up date (3 days from now)
function getFollowUpDate() {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Log Outreach Activity to Local Storage
function logOutreachEvent(businessName, country, messageBody, channelName) {
    const activeProfile = getActiveSyncProfile();
    const operator = activeProfile.name;
    
    const logs = JSON.parse(localStorage.getItem('outreach_logs')) || [];
    const newLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toLocaleString(),
        business: businessName,
        country: country || 'USA',
        channel: channelName || 'Email',
        message: messageBody || '',
        status: 'Sent',
        follow_up_date: getFollowUpDate(),
        operator: operator
    };
    
    logs.unshift(newLog); // Prepend so latest is first
    localStorage.setItem('outreach_logs', JSON.stringify(logs));
    
    // Refresh log table if view is currently active
    renderOutreachLogs();
}

// Helper to get localized currency format based on country
function getDealValueAndCurrency(country) {
    let symbol = '$';
    let value = 1500;
    if (country === 'UK') {
        symbol = '£';
        value = 850;
    } else if (country === 'Australia') {
        symbol = 'AUD £'; // use £ symbol as requested: "£ -> UK, Australia (use AUD label)"
        value = 1800;
    } else if (country === 'South Africa') {
        symbol = 'ZAR £'; // use £ symbol as requested: "£ -> South Africa (use ZAR label)"
        value = 6500;
    } else if (country === 'USA') {
        symbol = '$';
        value = 1200;
    } else if (country === 'Canada') {
        symbol = '$';
        value = 1400;
    } else if (country === 'UAE') {
        symbol = 'AED';
        value = 4500;
    } else if (country === 'Nigeria') {
        symbol = '₦';
        value = 250000;
    } else if (country === 'India') {
        symbol = '₹';
        value = 15000;
    } else if (country === 'Brazil') {
        symbol = 'R$';
        value = 3500;
    } else if (country === 'Malaysia') {
        symbol = 'RM';
        value = 3200;
    } else if (country === 'Saudi Arabia') {
        symbol = 'SAR';
        value = 4000;
    } else if (country === 'Turkey') {
        symbol = '₺';
        value = 18000;
    } else if (country === 'Mexico') {
        symbol = 'MXN $';
        value = 16000;
    }
    return `${symbol} ${value.toLocaleString()}`;
}

window.changeLogStatus = function(logId, newStatus) {
    const logs = JSON.parse(localStorage.getItem('outreach_logs')) || [];
    const logIndex = logs.findIndex(l => l.id === logId);
    if (logIndex !== -1) {
        logs[logIndex].status = newStatus;
        localStorage.setItem('outreach_logs', JSON.stringify(logs));
        console.log(`Log status updated to ${newStatus}`);
        renderOutreachLogs(); // Immediate UI update!
    }
};

window.changeLeadStatus = function(businessName, newStatus) {
    const overrides = JSON.parse(localStorage.getItem('lead_status_overrides') || '{}');
    overrides[businessName] = newStatus;
    localStorage.setItem('lead_status_overrides', JSON.stringify(overrides));
    
    // Refresh directory filters & dashboard leads immediately
    applyDirectoryFilters();
    const nicheLeads = getLeadsByCurrentNiche();
    renderLeads(nicheLeads);
};

// Render Outreach Log Activity Table
function renderOutreachLogs() {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;
    
    const logs = JSON.parse(localStorage.getItem('outreach_logs')) || [];
    
    if (logs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty-state">
                    <i data-lucide="history"></i>
                    <p style="margin-top: 0.5rem;">No outreach logs recorded yet. Start pitching leads to see activity here!</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    tableBody.innerHTML = logs.map(log => {
        const country = log.country || 'USA';
        const channel = log.channel || log.status || 'Gmail';
        const rawMsg = log.message || log.action || 'Opened Gmail Draft';
        const messagePreview = rawMsg.length > 45 ? rawMsg.substring(0, 42) + '...' : rawMsg;
        const escapedMsg = rawMsg.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const recipientLabel = log.email && log.email !== 'N/A' ? log.email : channelNameForLog(channel);
        const logId = log.id || ('log_' + Math.random().toString(36).substr(2, 5));
        
        const wonDealHTML = log.status === 'Won' 
            ? `<div style="font-size: 0.75rem; color: #10b981; font-weight: bold; margin-top: 0.25rem;"><i data-lucide="party-popper" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Won Deal: ${getDealValueAndCurrency(country)}</div>`
            : '';
        
        return `
            <tr>
                <td style="color: var(--text-secondary); font-family: monospace; font-size: 0.8rem;">${log.timestamp}</td>
                <td style="font-weight: 600;">
                    ${log.business} 
                    <span style="font-size:0.75rem; font-weight: normal; color:var(--text-secondary); background:var(--bg-card); border: 1px solid var(--border-color); padding: 0.1rem 0.35rem; border-radius: 4px; margin-left: 0.25rem;">${country}</span>
                </td>
                <td style="font-family: monospace; font-size: 0.8rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${recipientLabel}
                </td>
                <td>
                    <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${channel}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapedMsg}">${messagePreview}</div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">
                            ${(log.operator || 'O').charAt(0)}
                        </div>
                        <span style="font-size: 0.8rem;">${log.operator || 'Operator'}</span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <select class="log-status-select" onchange="changeLogStatus('${logId}', this.value)">
                            <option value="Sent" ${log.status === 'Sent' || !log.status ? 'selected' : ''}>Sent</option>
                            <option value="Replied" ${log.status === 'Replied' ? 'selected' : ''}>Replied</option>
                            <option value="Interested" ${log.status === 'Interested' ? 'selected' : ''}>Interested</option>
                            <option value="Meeting Scheduled" ${log.status === 'Meeting Scheduled' ? 'selected' : ''}>Meeting Scheduled</option>
                            <option value="Won" ${log.status === 'Won' ? 'selected' : ''}>Won</option>
                            <option value="Closed" ${log.status === 'Closed' ? 'selected' : ''}>Closed</option>
                        </select>
                        ${wonDealHTML}
                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Follow up: ${log.follow_up_date || getFollowUpDate()}</div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

// Helper to resolve contact destination label for logs table
function channelNameForLog(channel) {
    if (channel && channel.includes('Email')) return 'Email Pitch Recipient';
    if (channel && channel.includes('WhatsApp')) return 'WhatsApp Chat';
    return 'Social DM';
}
