// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTheme();
    initClock();
    fetchLeads();
    initChromeSettings();
    initEventListeners();
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
    themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
    
    themeToggle.addEventListener('click', () => {
        const isCurrentlyDark = document.body.classList.contains('dark-theme');
        if (isCurrentlyDark) {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            themeIcon.setAttribute('data-lucide', 'moon');
        } else {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            themeIcon.setAttribute('data-lucide', 'sun');
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
let currentNiche = 'All'; // Default active niche

// Filter global cache by the currently selected niche
function getLeadsByCurrentNiche() {
    if (currentNiche === 'All') {
        return allLeadsCache;
    }
    return allLeadsCache.filter(lead => lead.niche === currentNiche);
}

// Fetch Leads Data
async function fetchLeads() {
    const grid = document.getElementById('lead-grid');
    grid.innerHTML = '<div class="lead-card" style="grid-column: 1/-1; text-align: center; padding: 4rem;">Loading amazing leads...</div>';
    
    try {
        const response = await fetch('/api/leads');
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

// Render Leads
function renderLeads(leads) {
    const grid = document.getElementById('lead-grid');
    grid.innerHTML = '';
    
    if (leads.length === 0) {
        grid.innerHTML = '<div class="lead-card" style="grid-column: 1/-1; text-align: center; padding: 4rem;">No leads found.</div>';
        return;
    }
    
    leads.forEach(lead => {
        // Map data fields (handle both old and new CSV formats)
        const name = lead.business_name || lead.name || 'Unknown Business';
        const phone = lead.validated_phone || lead.phone || 'N/A';
        const website = lead.website_url || lead.website || 'None';
        const fb = lead.facebook_url || 'None';
        const email = lead.validated_email || 'N/A';
        const score = parseInt(lead.website_score || 1);
        
        const isHot = website === 'None' || score <= 3;
        
        const hasEmail = email !== 'N/A' && email !== '';
        const hasPhone = phone !== 'N/A' && phone !== '';
        const hasFb = fb !== 'None' && fb !== '' && !fb.includes('search/top');
        
        let actionButtonHTML = '';
        if (hasEmail) {
            actionButtonHTML = `
                <button class="btn btn-primary" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}')">
                    <i data-lucide="send"></i>
                    Send Pitch
                </button>
            `;
        } else if (hasPhone) {
            // Clean phone to numeric-only digits for WhatsApp
            const phoneDigits = phone.replace(/\D/g, '');
            const waPhone = phoneDigits.length === 10 ? `1${phoneDigits}` : phoneDigits;
            
            const activeProfile = getActiveSyncProfile();
            const signature = activeProfile.signature;
            
            let nicheLabel = currentNiche.toLowerCase();
            if (nicheLabel === 'all') {
                nicheLabel = 'trade services';
            }
            
            const waMsg = encodeURIComponent(
                `Hi ${name} Team,\n\nI noticed your business doesn't have an optimized website (or it's currently hard to find on mobile devices).\n\nI build high-converting websites specifically for ${nicheLabel} businesses in your area. Would you be open to a quick chat to see how we could help you capture those missed leads?\n\nBest,\n${signature}`
            );
            
            const waLink = `https://wa.me/${waPhone}?text=${waMsg}`;
            actionButtonHTML = `
                <button class="btn btn-primary" onclick="window.open('${waLink}', '_blank')" style="background: #25d366; border-color: #25d366;">
                    <i data-lucide="message-square"></i>
                    WhatsApp Pitch
                </button>
            `;
        } else if (hasFb) {
            actionButtonHTML = `
                <button class="btn btn-primary" onclick="window.open('${fb}', '_blank')" style="background: #3b82f6; border-color: #3b82f6;">
                    <i data-lucide="facebook"></i>
                    Pitch on FB
                </button>
            `;
        } else {
            actionButtonHTML = `
                <button class="btn btn-primary" disabled style="background: var(--border-color); border-color: var(--border-color); cursor: not-allowed; color: var(--text-secondary);">
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
                        <i data-lucide="phone" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> ${phone}
                    </div>
                </div>
                ${isHot ? '<span class="status-badge status-hot">HOT</span>' : '<span class="status-badge" style="background: rgba(107, 114, 128, 0.2); color: var(--text-secondary);">WARM</span>'}
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
                    <span class="detail-value" style="font-weight:bold; color: ${score <= 3 ? 'var(--hot-color)' : 'var(--text-primary)'}">${score}/10</span>
                </div>
            </div>
            
            <div class="lead-actions">
                ${actionButtonHTML}
            </div>
        `;
        grid.appendChild(card);
    });
    
    lucide.createIcons();
}

// Update Stats
function updateStats(leads) {
    document.getElementById('stat-total').textContent = leads.length;
    
    const hotLeads = leads.filter(l => l.website_url === 'None' || parseInt(l.website_score || 5) <= 3).length;
    document.getElementById('stat-hot').textContent = hotLeads;
    
    document.getElementById('stat-avg').textContent = '92/100'; // Mock average quality of contact info
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
    
    currentEmailText = `Hi ${name} Team,\n\nI noticed your business doesn't have an optimized website (or it's currently hard to find on mobile devices).\n\nSince most customers searching for ${nicheLabel} in your area are doing so on their phones, a modern, fast-loading website can instantly increase your bookings.\n\nI build high-converting websites specifically for ${nicheLabel} businesses. Would you be open to a quick chat to see how we could help you capture those missed leads?\n\nBest,\n${signature}`;
    
    document.getElementById('email-body').innerHTML = currentEmailText.replace(/\n/g, '<br>');
    modal.style.display = 'flex';
};

// Event Listeners
function initEventListeners() {
    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        window.location.href = '/';
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
        const name = lead.business_name || lead.name || 'Unknown Business';
        const phone = lead.validated_phone || lead.phone || 'N/A';
        const website = lead.website_url || lead.website || 'None';
        const fb = lead.facebook_url || 'None';
        const email = lead.validated_email || 'N/A';
        const score = parseInt(lead.website_score || 1);
        
        const isHot = website === 'None' || score <= 3;
        
        const hasEmail = email !== 'N/A' && email !== '';
        const hasPhone = phone !== 'N/A' && phone !== '';
        const hasFb = fb !== 'None' && fb !== '' && !fb.includes('search/top');
        
        let directoryActionHTML = '';
        if (hasEmail) {
            directoryActionHTML = `
                <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="openOutreach('${name.replace(/'/g, "\\'")}', '${email}')">
                    <i data-lucide="send" style="width:12px; height:12px;"></i>
                    Send Pitch
                </button>
            `;
        } else if (hasPhone) {
            const phoneDigits = phone.replace(/\D/g, '');
            const waPhone = phoneDigits.length === 10 ? `1${phoneDigits}` : phoneDigits;
            
            const activeProfile = getActiveSyncProfile();
            const signature = activeProfile.signature;
            
            let nicheLabel = currentNiche.toLowerCase();
            if (nicheLabel === 'all') {
                nicheLabel = 'trade services';
            }
            
            const waMsg = encodeURIComponent(
                `Hi ${name} Team,\n\nI noticed your business doesn't have an optimized website (or it's currently hard to find on mobile devices).\n\nI build high-converting websites specifically for ${nicheLabel} businesses in your area. Would you be open to a quick chat to see how we could help you capture those missed leads?\n\nBest,\n${signature}`
            );
            
            const waLink = `https://wa.me/${waPhone}?text=${waMsg}`;
            directoryActionHTML = `
                <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: #25d366; border-color: #25d366;" onclick="window.open('${waLink}', '_blank')">
                    <i data-lucide="message-square" style="width:12px; height:12px;"></i>
                    WhatsApp
                </button>
            `;
        } else if (hasFb) {
            directoryActionHTML = `
                <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem; background: #3b82f6; border-color: #3b82f6;" onclick="window.open('${fb}', '_blank')">
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
        
        return `
            <tr>
                <td style="font-weight: 600;">${name}</td>
                <td style="color: var(--text-secondary);">${phone}</td>
                <td style="font-family: monospace; font-size: 0.85rem;">${email}</td>
                <td style="font-weight: bold; color: ${score <= 3 ? 'var(--hot-color)' : 'var(--text-primary)'}">${score}/10</td>
                <td>
                    ${isHot ? '<span class="status-badge status-hot">HOT</span>' : '<span class="status-badge" style="background: rgba(107, 114, 128, 0.2); color: var(--text-secondary);">WARM</span>'}
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
    
    const radioAll = document.getElementById('filter-quality-all').checked;
    const radioHigh = document.getElementById('filter-quality-high').checked; // Score <= 3
    const radioGood = document.getElementById('filter-quality-good').checked; // Score >= 4
    
    const filteredLeads = getLeadsByCurrentNiche().filter(lead => {
        const name = (lead.business_name || lead.name || '').toLowerCase();
        const phone = (lead.validated_phone || lead.phone || '').toLowerCase();
        const email = (lead.validated_email || '').toLowerCase();
        
        // 1. Search Query filter
        const matchesQuery = name.includes(query) || phone.includes(query) || email.includes(query);
        if (!matchesQuery) return false;
        
        // 2. Status filter
        const website = lead.website_url || lead.website || 'None';
        const score = parseInt(lead.website_score || 1);
        const isHot = website === 'None' || score <= 3;
        
        if (isHot && !filterHot) return false;
        if (!isHot && !filterWarm) return false;
        
        // 3. Quality score filter
        if (radioHigh && score > 3) return false;
        if (radioGood && score < 4) return false;
        
        return true;
    });
    
    renderDirectoryLeads(filteredLeads);
}

// Log Outreach Activity to Local Storage
function logOutreachEvent(businessName, email, actionName, statusBadge) {
    const activeProfile = getActiveSyncProfile();
    const operator = activeProfile.name;
    
    const logs = JSON.parse(localStorage.getItem('outreach_logs')) || [];
    const newLog = {
        timestamp: new Date().toLocaleString(),
        business: businessName,
        email: email,
        action: actionName,
        operator: operator,
        status: statusBadge
    };
    
    logs.unshift(newLog); // Prepend so latest is first
    localStorage.setItem('outreach_logs', JSON.stringify(logs));
    
    // Refresh log table if view is currently active
    renderOutreachLogs();
}

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
    
    tableBody.innerHTML = logs.map(log => `
        <tr>
            <td style="color: var(--text-secondary); font-family: monospace;">${log.timestamp}</td>
            <td style="font-weight: 600;">${log.business}</td>
            <td style="font-family: monospace; font-size: 0.85rem;">${log.email}</td>
            <td>${log.action}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">
                        ${log.operator.charAt(0)}
                    </div>
                    <span>${log.operator}</span>
                </div>
            </td>
            <td>
                <span class="badge-custom ${log.status === 'Copied' ? 'badge-copied' : 'badge-gmail'}">${log.status}</span>
            </td>
        </tr>
    `).join('');
    
    lucide.createIcons();
}
