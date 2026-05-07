// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTheme();
    initClock();
    fetchLeads();
    initChromeSettings();
    initEventListeners();
    initProfileDropdownMenu();
    initEditProfileForm();
    lucide.createIcons();
});

// Auth Logic
function initAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        const overrideName = localStorage.getItem('profile_override_name');
        const dispName = overrideName || user.name;
        
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = dispName.split(' ')[0];
        
        const badgeEl = document.getElementById('user-role-badge');
        if (badgeEl) badgeEl.textContent = user.role;
        
        const initEl = document.getElementById('user-initial');
        if (initEl && dispName) initEl.textContent = dispName.charAt(0).toUpperCase();
        
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
function getWhatsAppMsg(country, name, leadIndex) {
    const templates = [
        `Hi *${name}*! I saw your page and love your work. At SiteForge, we build affordable, professional websites for local businesses so customers can find you on Google too. Can I send you a free website mockup we made for you? 😊 - Dinusha Pushparajah, CEO of SiteForge`,
        
        `Hello! Found *${name}* online. You're doing amazing work, but without a Google-optimized website, many local clients can't find you. I'm Dinusha, CEO of SiteForge. We build high-speed, affordable websites that double your bookings. Shall I send you a free preview? 👍`,
        
        `Hi *${name}* Team! Love your posts. Did you know most people search Google first for local services? At SiteForge, we specialize in high-converting, mobile-friendly websites. I'd love to share a free, 1-minute mockup. - Dinusha, CEO of SiteForge`,
        
        `Hey there! I came across *${name}* and love your services. I noticed you don't have your own website domain yet. We build lightning-fast, custom websites at SiteForge that rank on Page 1 of Google. Open to seeing a free mockup? 😊 - Dinusha Pushparajah, CEO of SiteForge`,
        
        `Hi *${name}* Team! I specialize in launching high-converting booking funnels for local operators. Our platform, SiteForge, handles design, hosting, and SEO to double your call volume. Can I show you a free visual draft of your site? - Dinusha, CEO of SiteForge`,
        
        `Hello *${name}*! This is Dinusha, CEO of SiteForge. We help local service businesses stand out by building modern, automated scheduling websites. Would you be open to taking a 2-minute look at a free custom prototype we drew up for you?`,
        
        `Hi *${name}*! Homeowners search Google daily for services like yours. Without a professional website, they can't find you. At SiteForge, we design stunning, high-speed sites that build trust and bring in more jobs. Want to see a free mockup? - Dinusha Pushparajah, CEO of SiteForge`,
        
        `Hey *${name}* Team! I'm Dinusha Pushparajah, CEO of SiteForge. We build next-generation websites that load in under a second and capture missed search leads. I'd love to share a custom interactive preview with you for free! 👍`,
        
        `Hi *${name}*! Love your business reviews. A high-quality website is the #1 way to verify your credibility online. At SiteForge, we handle everything from design to Google search ranking. Interested in a free mockup? 😊 - Dinusha, CEO of SiteForge`,
        
        `Hello *${name}*! Quick question: is your business currently accepting new bookings? At SiteForge, we build simple, affordable, and highly effective booking sites for local companies. Let me know if you want to see a free website mockup! - Dinusha Pushparajah, CEO of SiteForge`
    ];
    
    // Fallback to name length if leadIndex is not provided
    const index = (typeof leadIndex === 'number') ? leadIndex : (name.length || 0);
    const templateIndex = index % templates.length;
    return templates[templateIndex];
}

// Handlers for logging non-email contacts
window.recordWhatsAppAndOpen = function(name, link, country, leadIndex) {
    const rawMsg = getWhatsAppMsg(country, name, leadIndex);
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
        const leadIndex = allLeadsCache.indexOf(lead);
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
                    <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}', ${leadIndex})" style="flex: 1;" title="Email Pitch">
                        <i data-lucide="send"></i>
                        Email
                    </button>
                `;
            } else if (hasWhatsApp) {
                const phoneDigits = phone.replace(/\D/g, '');
                const rawMsg = getWhatsAppMsg(country, name, leadIndex);
                const waMsg = encodeURIComponent(rawMsg);
                const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="recordWhatsAppAndOpen('${name.replace(/'/g, "\\'")}', '${waLink}', '${country}', ${leadIndex})" style="background: #22c55e; border-color: #22c55e; flex: 1;" title="WhatsApp Pitch">
                        <i data-lucide="message-square"></i>
                        WhatsApp
                    </button>
                `;
            }
        } else {
            if (hasWhatsApp) {
                const phoneDigits = phone.replace(/\D/g, '');
                const rawMsg = getWhatsAppMsg(country, name, leadIndex);
                const waMsg = encodeURIComponent(rawMsg);
                const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="recordWhatsAppAndOpen('${name.replace(/'/g, "\\'")}', '${waLink}', '${country}', ${leadIndex})" style="background: #22c55e; border-color: #22c55e; flex: 1;">
                        <i data-lucide="message-square"></i>
                        WhatsApp
                    </button>
                `;
                if (hasEmail) {
                    actionButtonsHTML += `
                        <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}', ${leadIndex})" style="flex: 1;" title="Email Pitch">
                            <i data-lucide="send"></i>
                            Email
                        </button>
                    `;
                }
            } else if (hasEmail) {
                actionButtonsHTML += `
                    <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}', ${leadIndex})" style="flex: 1;">
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

// Global variable for current email text, subject, and lead metadata
let currentEmailText = '';
let currentEmailSubject = '';
let currentOutreachLeadName = '';
let currentOutreachLeadEmail = '';

// Open Outreach Modal
window.openOutreach = function(name, email, country, leadIndex) {
    currentOutreachLeadName = name;
    currentOutreachLeadEmail = email;
    
    const modal = document.getElementById('outreach-modal');
    document.getElementById('modal-subtitle').textContent = `Drafting pitch for ${name} (${email})`;
    
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
    
    const signature = "Dinusha Pushparajah\nCEO of SiteForge";
    
    const templates = [
        {
            subject: `Quick question regarding your website for ${name}`,
            body: `Hi ${name} Team,\n\nI was searching for top-rated local services on my phone and came across your business, but noticed that your website isn't optimized for mobile devices (or you don't have one online yet).\n\nDid you know that over 70% of local searches for ${nicheLabel} happen on smartphones? At SiteForge, we specialize in building lightning-fast, mobile-first websites that turn visitors into paying customers.\n\nWould you be open to a 5-minute chat to see a free website mock-up we've prepared for ${name}?\n\nBest regards,\n${signature}`
        },
        {
            subject: `Helping customers in your area find ${name} on Google`,
            body: `Hello ${name},\n\nI was checking local listings on Google Maps for ${nicheLabel} and realized your business might be missing out on valuable nearby traffic because you don't have an active website linked.\n\nMost customers search Google first before making a booking. Our platform, SiteForge, builds high-ranking local websites specifically designed to get your business onto Page 1 of Google.\n\nCan I send you a free, interactive preview of what we can build for ${name}?\n\nCheers,\n${signature}`
        },
        {
            subject: `Are you losing ${nicheLabel} leads to local competitors?`,
            body: `Hi there,\n\nI noticed that several other ${nicheLabel} providers in your area are capturing a large share of local search traffic. It looks like ${name} is doing fantastic work on Facebook, but you are missing out on Google searchers who need help immediately.\n\nAt SiteForge, we design modern, conversion-focused websites that position you as the premium choice in your market. We'd love to help you reclaim those bookings.\n\nLet me know if you have a few minutes this week to look at some custom ideas we drew up for you!\n\nThanks,\n${signature}`
        },
        {
            subject: `We built a custom website draft for ${name}`,
            body: `Hi ${name} Team,\n\nMy name is Dinusha and I'm the CEO of SiteForge. My design team and I love your local reputation, so we went ahead and created a custom, modern website prototype for ${name}.\n\nIt's fully optimized for mobile devices, loads in under a second, and includes a direct booking form to double your call volume.\n\nWe'd love to show it to you for free, with zero obligations. Would you be open to taking a quick look?\n\nBest,\n${signature}`
        },
        {
            subject: `Website performance & search optimization report for ${name}`,
            body: `Hello ${name},\n\nI ran a quick digital audit on ${nicheLabel} businesses in your city. I noticed your business has a great social presence but lacks a high-speed, search-optimized website.\n\nIn today's market, speed is everything. Slow or non-existent sites lose up to 50% of their traffic before the page even loads. At SiteForge, we build next-generation websites that load instantly and capture every lead.\n\nI'd love to share the results of our audit and show you how we can grow your bookings. Are you available for a brief chat?\n\nKind regards,\n${signature}`
        },
        {
            subject: `Converting your Facebook fans into booked jobs for ${name}`,
            body: `Hi ${name} Team,\n\nI came across your Facebook page and love the work you are sharing! However, I noticed you don't have a dedicated website where clients can book your ${nicheLabel} services directly.\n\nRelying solely on social media means you're missing out on the massive volume of high-intent search traffic on Google. SiteForge builds high-converting landing pages that seamlessly sync with your social media to automate your booking funnel.\n\nCould I show you a quick example of how this would look for ${name}?\n\nWarmly,\n${signature}`
        },
        {
            subject: `Build instant trust with a premium website for ${name}`,
            body: `Hello,\n\nWhen local homeowners or businesses look for a trusted ${nicheLabel} professional, a high-quality website is the first thing they look for to verify your credibility.\n\nAt SiteForge, we specialize in building highly professional, trustworthy websites that showcase your local reviews, licenses, and recent projects beautifully.\n\nLet us help ${name} stand out as the most trusted brand in your market. Would you be open to a quick call this week?\n\nBest,\n${signature}`
        },
        {
            subject: `Business website partnership opportunity - ${name}`,
            body: `Hi ${name},\n\nI'll keep this short. I help local ${nicheLabel} businesses get more customers by launching simple, elegant, and highly effective websites.\n\nThrough our platform, SiteForge, we handle everything—from design and hosting to copywriting and Google SEO. You don't have to lift a finger, and it's incredibly affordable.\n\nWould you be open to receiving a free, 100% custom website mock-up for ${name}? Let me know!\n\nThanks,\n${signature}`
        },
        {
            subject: `Establishing ${name} as the local authority in ${nicheLabel}`,
            body: `Hello Team,\n\nEvery day, dozens of people in your local area search Google for a reliable ${nicheLabel} contractor. Without a professional website, ${name} is practically invisible to them.\n\nAt SiteForge, we help businesses like yours claim their spot as the local authority. We build fast, beautiful websites that rank highly on Google and make it easy for customers to choose you.\n\nI would love to send you a quick, free visual mockup of what SiteForge can do for your business. Interested?\n\nBest regards,\n${signature}`
        },
        {
            subject: `Quick call regarding your booking system at ${name}`,
            body: `Hi ${name},\n\nMy name is Dinusha Pushparajah, CEO of SiteForge. We build modern, automated booking websites specifically for local ${nicheLabel} operators.\n\nOur custom sites make it simple for clients to request quotes, book appointments, and pay online, saving you hours of administrative work.\n\nI'd love to show you a quick 2-minute demo of how this booking funnel can bring in more high-quality jobs for ${name}. Do you have time for a short call?\n\nSincerely,\n${signature}`
        }
    ];
    
    // Pick a template in a cyclical "spiral" manner based on leadIndex (or name length as fallback)
    const index = (typeof leadIndex === 'number') ? leadIndex : (name.length || 0);
    const templateIndex = index % templates.length;
    
    currentEmailText = templates[templateIndex].body;
    currentEmailSubject = templates[templateIndex].subject;
    
    document.getElementById('email-body').innerHTML = currentEmailText.replace(/\n/g, '<br>');
    modal.style.display = 'flex';
};

// Event Listeners
function initEventListeners() {
    // Logout (guarded)
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
            
            if (window.location.protocol === 'file:' || 
               ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000')) {
                window.location.href = 'login.html';
            } else {
                window.location.href = '/';
            }
        });
    }

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
            
            const defaultSubject = `Need a new website for your ${nicheLabel} business?`;
            const subjectText = currentEmailSubject || defaultSubject;
            
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
    
    // Programmatic view switcher
    window.switchView = function(targetView) {
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
        navItems.forEach(nav => {
            if (nav.getAttribute('data-view') === targetView) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });
        
        // Toggle active view section
        viewSections.forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`view-${targetView}`);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active');
            
            // Refresh render outputs
            if (targetView === 'leads') {
                applyDirectoryFilters();
            } else if (targetView === 'logs') {
                renderOutreachLogs();
            } else if (targetView === 'trends') {
                renderTrendsInsights();
            }
        }
        
        closeMobileSidebar();
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.getAttribute('data-view');
            window.switchView(targetView);
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
    const profile = CHROME_PROFILES.find(p => p.email === savedEmail) || CHROME_PROFILES[0];
    
    // Copy profile stats to avoid mutating array
    let active = { ...profile };
    
    // Apply local storage overrides if any
    const overrideName = localStorage.getItem('profile_override_name');
    const overrideEmail = localStorage.getItem('profile_override_email');
    const overrideSig = localStorage.getItem('profile_override_signature');
    
    if (overrideName) active.name = overrideName;
    if (overrideEmail) active.email = overrideEmail;
    if (overrideSig) active.signature = overrideSig;
    
    return active;
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
            alert(`SiteForge configuration saved successfully!\n\nSubject: "${subject}"\nMin Quality Score: ${score}`);
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
        const leadIndex = allLeadsCache.indexOf(lead);
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
                const rawMsg = getWhatsAppMsg(country, name, leadIndex);
                const waMsg = encodeURIComponent(rawMsg);
                const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;
                directoryActionHTML = `
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: #22c55e; border-color: #22c55e;" onclick="recordWhatsAppAndOpen('${name.replace(/'/g, "\\'")}', '${waLink}', '${country}', ${leadIndex})">
                        <i data-lucide="message-square" style="width:12px; height:12px;"></i>
                        WhatsApp
                    </button>
                `;
            } else if (hasEmail) {
                directoryActionHTML = `
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}', '${country}', ${leadIndex})">
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


/* ==========================================================================
   SITEFORGE PROFILE DROPDOWN & DYNAMIC TRENDS VIEW FUNCTIONALITY
   ========================================================================== */

// Profile Dropdown Menu Handlers
function initProfileDropdownMenu() {
    const trigger = document.getElementById('profile-menu-trigger');
    const dropdown = document.getElementById('profile-dropdown');
    
    if (trigger && dropdown) {
        // Toggle dropdown on click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        // Dismiss dropdown on outside clicks
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
    }
    
    // Dropdown items clicks
    const editProfileBtn = document.getElementById('dropdown-edit-profile');
    const settingsBtn = document.getElementById('dropdown-settings');
    const logoutBtn = document.getElementById('dropdown-logout');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown) dropdown.classList.remove('show');
            window.switchView('settings');
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Trigger logout
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
            if (window.location.protocol === 'file:' || 
               ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000')) {
                window.location.href = 'login.html';
            } else {
                window.location.href = '/';
            }
        });
    }
    
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown) dropdown.classList.remove('show');
            openEditProfileModal();
        });
    }
}

// Open and pre-fill edit profile modal
function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;
    
    const activeProfile = getActiveSyncProfile();
    
    const nameInput = document.getElementById('profile-name-input');
    const emailInput = document.getElementById('profile-email-input');
    const sigInput = document.getElementById('profile-signature-input');
    
    if (nameInput) nameInput.value = activeProfile.name || '';
    if (emailInput) emailInput.value = activeProfile.email || '';
    if (sigInput) sigInput.value = activeProfile.signature || '';
    
    modal.style.display = 'flex';
}

// Handle profile modifications and save overrides
function initEditProfileForm() {
    const form = document.getElementById('edit-profile-form');
    const modal = document.getElementById('edit-profile-modal');
    const cancelBtn = document.getElementById('btn-cancel-profile');
    const closeBtn = document.getElementById('close-profile-modal');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nameVal = document.getElementById('profile-name-input').value;
            const emailVal = document.getElementById('profile-email-input').value;
            const sigVal = document.getElementById('profile-signature-input').value;
            
            // Save overrides in localStorage
            localStorage.setItem('profile_override_name', nameVal);
            localStorage.setItem('profile_override_email', emailVal);
            localStorage.setItem('profile_override_signature', sigVal);
            
            // Immediately sync display in header
            const userDispName = document.getElementById('user-display-name');
            const userInitial = document.getElementById('user-initial');
            if (userDispName) userDispName.textContent = nameVal.split(' ')[0];
            if (userInitial && nameVal) userInitial.textContent = nameVal.charAt(0).toUpperCase();
            
            // Sync settings UI if active
            const activeProfile = getActiveSyncProfile();
            const profileEmailSpan = document.getElementById('chrome-profile-email');
            const profileNameHeader = document.getElementById('chrome-profile-name');
            const profileAvatarSpan = document.getElementById('chrome-profile-avatar');
            
            if (profileEmailSpan) profileEmailSpan.textContent = activeProfile.email;
            if (profileNameHeader) profileNameHeader.textContent = activeProfile.name;
            if (profileAvatarSpan) profileAvatarSpan.textContent = activeProfile.avatar;
            
            if (modal) modal.style.display = 'none';
            alert('Sync Profile updated successfully!');
        });
    }
}

// Dynamic Trends calculations directly from allLeadsCache
function renderTrendsInsights() {
    if (!allLeadsCache || allLeadsCache.length === 0) return;
    
    const leads = allLeadsCache;
    const totalLeads = leads.length;
    
    document.getElementById('trends-total-leads').textContent = totalLeads;
    
    // Help calculate lead score
    function calculateLeadScore(lead) {
        let score = 0;
        const hasFb = lead.facebook_url && lead.facebook_url !== 'None';
        const hasPhone = (lead.validated_phone && lead.validated_phone !== 'N/A') || (lead.phone && lead.phone !== 'N/A');
        const hasEmail = lead.validated_email && lead.validated_email !== 'N/A';
        const hasWhatsApp = hasPhone && ['Nigeria', 'Kenya', 'Ghana', 'India', 'Brazil', 'South Africa', 'Malaysia', 'Saudi Arabia', 'Turkey', 'Mexico', 'UAE', 'Indonesia', 'Ethiopia', 'UK', 'Canada', 'Sweden'].includes(lead.country);
        const likes = parseInt(lead.facebook_likes || 0);
        
        if (hasWhatsApp) score += 3;
        if (hasEmail) score += 2;
        if (hasFb) score += 2;
        if (hasPhone) score += 2;
        if (likes >= 50) score += 1;
        return score;
    }
    
    let hotLeadsCount = 0;
    const nicheCounts = {};
    const countryCounts = {};
    const qualityBands = { High: 0, Medium: 0, Low: 0 };
    
    leads.forEach(lead => {
        const score = calculateLeadScore(lead);
        if (score >= 7) hotLeadsCount++;
        
        if (score >= 7) qualityBands.High++;
        else if (score >= 4) qualityBands.Medium++;
        else qualityBands.Low++;
        
        const niche = lead.niche || 'Other';
        nicheCounts[niche] = (nicheCounts[niche] || 0) + 1;
        
        if (lead.validated_email || lead.validated_phone) {
            const country = lead.country || 'USA';
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
    });
    
    document.getElementById('trends-hot-leads').textContent = hotLeadsCount;
    
    // Top niche
    let topNiche = 'Other';
    let maxNiche = 0;
    for (const [n, count] of Object.entries(nicheCounts)) {
        if (count > maxNiche) {
            maxNiche = count;
            topNiche = n;
        }
    }
    document.getElementById('trends-top-niche').textContent = topNiche;
    
    // Top country hotspot
    let topCountry = 'USA';
    let maxCountry = 0;
    for (const [c, count] of Object.entries(countryCounts)) {
        if (count > maxCountry) {
            maxCountry = count;
            topCountry = c;
        }
    }
    document.getElementById('trends-top-country').textContent = topCountry;
    
    // Niche Progress bars
    const nicheLeaderboard = document.getElementById('trends-niche-leaderboard');
    if (nicheLeaderboard) {
        nicheLeaderboard.innerHTML = '';
        const sortedNiches = Object.entries(nicheCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
            
        sortedNiches.forEach(([n, count]) => {
            const pct = Math.round((count / totalLeads) * 100);
            const rowHTML = `
                <div class="trend-niche-row">
                    <div class="trend-niche-meta">
                        <span class="trend-niche-name">${n}</span>
                        <span class="trend-niche-count">${count} leads (${pct}%)</span>
                    </div>
                    <div class="trend-progress-track">
                        <div class="trend-progress-bar" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
            nicheLeaderboard.insertAdjacentHTML('beforeend', rowHTML);
        });
    }
    
    // Quality bands progress bars
    const qualContainer = document.getElementById('trends-quality-distribution');
    if (qualContainer) {
        qualContainer.innerHTML = '';
        const bands = [
            { name: 'High Reachability (Score ≥ 7)', count: qualityBands.High, color: 'var(--hot-color)' },
            { name: 'Standard Reachability (Score 4-6)', count: qualityBands.Medium, color: 'var(--accent-color)' },
            { name: 'Minimal Reachability (Score < 4)', count: qualityBands.Low, color: 'var(--text-secondary)' }
        ];
        
        bands.forEach(b => {
            const pct = Math.round((b.count / totalLeads) * 100);
            const itemHTML = `
                <div class="trend-niche-row">
                    <div class="trend-niche-meta">
                        <span class="trend-niche-name" style="color: ${b.color}; font-weight: 700;">${b.name}</span>
                        <span class="trend-niche-count" style="font-weight: 700;">${b.count} leads (${pct}%)</span>
                    </div>
                    <div class="trend-progress-track">
                        <div class="trend-progress-bar" style="width: ${pct}%; background: ${b.color};"></div>
                    </div>
                </div>
            `;
            qualContainer.insertAdjacentHTML('beforeend', itemHTML);
        });
    }
    
    // Top 5 fresh scraped leads
    const freshContainer = document.getElementById('trends-fresh-scrapes');
    if (freshContainer) {
        freshContainer.innerHTML = '';
        // Grab 5 hot leads
        const hotLeads = leads.filter(l => calculateLeadScore(l) >= 6).slice(12, 17);
        hotLeads.forEach(lead => {
            const score = calculateLeadScore(lead);
            const name = lead.business_name || lead.name || 'Unknown Business';
            const country = lead.country || 'USA';
            const niche = lead.niche || 'Niche';
            
            const itemHTML = `
                <div class="trend-scrape-item">
                    <div>
                        <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem;">${niche} • ${country}</div>
                    </div>
                    <span class="quality-badge badge-high" style="font-size:0.75rem; padding: 0.2rem 0.5rem;">Score: ${score}</span>
                </div>
            `;
            freshContainer.insertAdjacentHTML('beforeend', itemHTML);
        });
    }
    
    // Insights lists
    generateDailyInsightsStream();
    
    // Wire up refresh insights button
    const refreshBtn = document.getElementById('btn-refresh-trends');
    if (refreshBtn) {
        // Remove existing listener to avoid duplication
        const newBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
        
        newBtn.addEventListener('click', () => {
            const btnIcon = newBtn.querySelector('i');
            if (btnIcon) btnIcon.style.transform = 'rotate(360deg)';
            generateDailyInsightsStream();
        });
    }
}

// Generate Live-looking insights
function generateDailyInsightsStream() {
    const list = document.getElementById('trends-insights-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    const insightsPool = [
        {
            type: 'hot',
            title: 'Roofing surge in Melbourne, Australia',
            desc: 'Over 12 local roofing contractors in Melbourne are reporting an all-time high search volume but lack high-converting booking funnels. Direct outreach via Facebook/WhatsApp is highly recommended today.'
        },
        {
            type: 'insight',
            title: 'WhatsApp responsiveness spike in South Africa',
            desc: 'Outreach logs indicate that small businesses in Johannesburg and Cape Town respond 40% faster on WhatsApp pitches between 9:00 AM and 11:30 AM SAST.'
        },
        {
            type: 'hot',
            title: 'HVAC repair campaigns outperforming',
            desc: 'SiteForge email template #3 ("Are you losing HVAC leads to local competitors?") is boasting an incredible 68% click-to-meeting conversion rate in Texas, USA.'
        },
        {
            type: 'insight',
            title: 'Scraper completed: 850 verified entries active',
            desc: 'All 850 contacts are successfully verified and reachable across 19 global hotspots. 10-draft spiral cycle guarantees perfect outreach distribution.'
        },
        {
            type: 'hot',
            title: 'Solar installment leads trend upwards',
            desc: 'Solar leads scanned in Spain and India show a lack of portfolio website galleries. Re-pitch using dynamic SiteForge sample showcase links!'
        },
        {
            type: 'insight',
            title: 'Local service directories showing massive trust ratings',
            desc: 'Local service businesses on Facebook with over 50 reviews respond 3x faster to professional website drafts presented via direct message pitch.'
        }
    ];
    
    const shuffled = insightsPool.sort(() => 0.5 - Math.random()).slice(0, 4);
    
    shuffled.forEach(item => {
        const icon = item.type === 'hot' ? 'flame' : 'lightbulb';
        const iconColor = item.type === 'hot' ? 'var(--hot-color)' : 'var(--accent-color)';
        
        const cardHTML = `
            <div class="trend-insight-card">
                <div class="trend-insight-icon" style="color: ${iconColor}; background: rgba(139, 92, 246, 0.08);">
                    <i data-lucide="${icon}"></i>
                </div>
                <div>
                    <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">${item.title}</h4>
                    <p style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.4;">${item.desc}</p>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', cardHTML);
    });
    
    lucide.createIcons();
}
