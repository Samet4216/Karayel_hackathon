// Admin Dashboard JavaScript

// ============== GLOBAL VARIABLES ==============
let mapLayersGroup = null;

// ============== DARK MODE TOGGLE ==============
function toggleAdminDarkMode() {
    document.body.classList.toggle('admin-dark-mode');
    const isDarkMode = document.body.classList.contains('admin-dark-mode');
    localStorage.setItem('adminDarkMode', isDarkMode);
    
    // Update button icon
    const themeBtn = document.querySelector('.btn-theme');
    if (themeBtn) {
        themeBtn.textContent = isDarkMode ? '☀️' : '🌙';
    }
    
    // Refresh reports to apply new theme colors
    loadPendingReports();
    
    // Reload history reports with current filter
    const activeFilter = document.querySelector('input[name="statusFilter"]:checked');
    if (activeFilter) {
        loadHistoryReports(activeFilter.value);
    }
    
    // Refresh container-based history if currently viewing
    if (currentContainerId && currentContainerReports.length > 0) {
        filterContainerReports();
    }
    
    // Refresh users if users tab is visible
    const usersTab = document.getElementById('users-tab');
    if (usersTab && usersTab.style.display !== 'none') {
        loadUsers();
    }
}

// Load dark mode preference on page load
function initAdminDarkMode() {
    const isDarkMode = localStorage.getItem('adminDarkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('admin-dark-mode');
        const themeBtn = document.querySelector('.btn-theme');
        if (themeBtn) {
            themeBtn.textContent = '☀️';
        }
    }
}

// ============== PENDING REPORTS MANAGEMENT ==============
async function loadPendingReports() {
    try {
        const res = await fetch('/api/admin/pending-reports');
        const data = await res.json();
        
        const reportsList = document.getElementById('reportsList');
        const isDarkMode = document.body.classList.contains('admin-dark-mode');
        const emptyBg = isDarkMode ? 'background-color: #2d2d2d;' : '';
        const emptyText = isDarkMode ? 'color: #888;' : 'color: #666;';
        const labelText = isDarkMode ? 'color: #b0b0b0;' : 'color: #666;';
        const notesBg = isDarkMode ? '#1a2d42' : '#f0f7ff';
        const notesBorder = isDarkMode ? '#66c2ff' : '#0066B3';
        const notesText = isDarkMode ? '#e0e0e0' : '#333';
        
        if (!data.reports || data.reports.length === 0) {
            reportsList.innerHTML = `<div style="text-align: center; padding: 40px; ${emptyBg}"><p style="${emptyText}">✓ Henüz bildirim yok</p></div>`;
            return;
        }
        
        reportsList.innerHTML = data.reports.map(report => `
            <div class="report-card">
                <div class="report-image">
                    ${report.photo_url ? `<img src="${report.photo_url}" alt="Bildiri Fotoğrafı">` : '<span>Fotoğraf Yok</span>'}
                </div>
                <div class="report-content">
                    <div class="report-header">
                        <div>
                            <h3>Konteyner #${report.container_id}</h3>
                            <div style="font-size: 12px; ${labelText}">
                                ${report.user_name} (${report.user_tc})
                            </div>
                        </div>
                        <div class="report-status" style="background-color: ${report.report_status === 1 ? '#90EE90' : '#FFB6C6'}; color: ${report.report_status === 1 ? '#2d5016' : '#8b0000'}; padding: 8px 12px; border-radius: 4px; font-weight: 600;">
                            ${report.report_status === 1 ? '✓ Onaylandı' : '⏳ Onay Bekliyor'}
                        </div>
                    </div>
                    
                    <div class="report-info">
                        <div class="info-row">
                            <div class="info-label">📍 Mahalle</div>
                            <div class="info-value">${report.neighborhood || 'Bilgi yok'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">📦 Konteyner Tipi</div>
                            <div class="info-value">${report.container_type || 'Bilgi yok'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">👤 Bildiren: ${report.user_name}</div>
                            <div class="info-value">Güven Puanı: ${report.user_trust_score.toFixed(2)}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">📅 Bildirim Tarihi</div>
                            <div class="info-value">${new Date(report.created_at).toLocaleString('tr-TR')}</div>
                        </div>
                    </div>
                    
                    <div class="fill-comparison">
                        <div class="fill-item">
                            <div class="fill-label">Sistem Tahmini (ML)</div>
                            <div class="fill-value">${(report.system_fill_level * 100).toFixed(0)}%</div>
                        </div>
                        <div class="fill-item">
                            <div class="fill-label">Kullanıcı Bildirdiği</div>
                            <div class="fill-value">${(report.reported_fill_level * 100).toFixed(0)}%</div>
                        </div>
                    </div>
                    
                    ${report.notes ? `<div style="margin: 15px 0; padding: 15px; background: ${notesBg}; border-left: 4px solid ${notesBorder}; border-radius: 4px;">
                        <div style="font-weight: 600; color: ${notesBorder}; margin-bottom: 8px;">📝 Kullanıcı Notu:</div>
                        <div style="color: ${notesText}; line-height: 1.5;">${report.notes}</div>
                    </div>` : ''}
                    
                    ${report.report_status === 0 ? `<div class="report-actions" style="display: flex; gap: 10px; margin-top: 15px;">
                        <button class="btn-approve" onclick="approveReport(${report.id}, ${report.user_id}, ${report.container_id}, ${report.reported_fill_level})" style="flex: 1; padding: 10px 15px; background-color: #00A651; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 14px;">
                            ✓ KABUL ET (+0.25 Puan)
                        </button>
                        <button class="btn-reject" onclick="rejectReport(${report.id}, ${report.user_id})" style="flex: 1; padding: 10px 15px; background-color: #E74C3C; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 14px;">
                            ✗ REDDET (-0.25 Puan)
                        </button>
                    </div>` : `<div style="text-align: center; padding: 15px; ${labelText}; font-size: 14px;">✓ Bu bildiri zaten onaylanmıştır</div>`}
                </div>
            </div>
        `).join('');
        
    } catch (e) {
        console.error('Raporları yükleme hatası:', e);
        document.getElementById('reportsList').innerHTML = '<div style="color: red;">Hata: Raporları yüklerken sorun oluştu</div>';
    }
}

async function approveReport(reportId, userId, containerId, fillLevel) {
    if (!confirm('Bu bildirimi onaylamak istediğinizden emin misiniz? Kullanıcı +0.25 güven puanı kazanacak.')) return;
    
    try {
        const res = await fetch('/api/admin/approve-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_id: reportId,
                user_id: userId,
                container_id: containerId,
                new_fill_level: fillLevel
            })
        });
        
        const data = await res.json();
        if (data.success) {
            alert('✓ Bildiri onaylandı. Konteynır güncellendi ve kullanıcı puan kazandı.');
            loadPendingReports();
        } else {
            alert('✗ Hata: ' + data.error);
        }
    } catch (e) {
        alert('Hata: ' + e.message);
    }
}

async function rejectReport(reportId, userId) {
    if (!confirm('Bu bildirimi reddetmek istediğinizden emin misiniz? Kullanıcı -0.25 güven puanı kaybedecek.')) return;
    
    try {
        const res = await fetch('/api/admin/reject-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_id: reportId,
                user_id: userId
            })
        });
        
        const data = await res.json();
        if (data.success) {
            alert('✓ Bildiri reddedildi ve kullanıcı puan kaybetti.');
            loadPendingReports();
        } else {
            alert('✗ Hata: ' + data.error);
        }
    } catch (e) {
        alert('Hata: ' + e.message);
    }
}

// ============== TAB NAVIGATION ==============
function showAdminTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.admin-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Add active class to clicked button
    const activeButton = Array.from(tabButtons).find(btn => 
        btn.getAttribute('onclick').includes(`'${tabName}'`)
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Load reports based on tab
    if (tabName === 'pending') {
        loadPendingReports();
    } else if (tabName === 'history') {
        loadHistoryReports('approved');
    } else if (tabName === 'containers') {
        loadNeighborhoods();
    } else if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'logs') {
        displayLogs();
    }
}

async function loadHistoryReports(status = 'approved') {
    try {
        const res = await fetch(`/api/admin/report-history?status=${status}`);
        const data = await res.json();
        
        const historyList = document.getElementById('historyList');
        
        if (!data.reports || data.reports.length === 0) {
            historyList.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;"><p>✓ ${status === 'approved' ? 'Onaylanan' : status === 'rejected' ? 'Reddedilen' : ''} bildiri yok</p></div>`;
            return;
        }
        
        const isDarkMode = document.body.classList.contains('admin-dark-mode');
        const cardBg = isDarkMode ? '#2a3f5f' : '#f8f9fa';
        const cardBorder = isDarkMode ? '#3d5580' : '#ddd';
        const textColor = isDarkMode ? '#e0e0e0' : '#333';
        const labelColor = isDarkMode ? '#66c2ff' : '#0066B3';
        const photoPlaceholderBg = isDarkMode ? '#1f2d3d' : '#f0f0f0';
        const photoPlaceholderText = isDarkMode ? '#888' : '#999';
        const notesColor = isDarkMode ? '#ccc' : '#666';
        const approvedBg = '#00A651';
        const rejectedBg = '#E74C3C';
        
        historyList.innerHTML = data.reports.map(report => `
            <div class="history-report-card" style="background: ${cardBg}; border: 2px solid ${cardBorder}; border-radius: 8px; padding: 15px; margin-bottom: 15px; cursor: pointer; transition: all 0.3s; display: flex; gap: 15px; align-items: center;" 
                 onclick="showHistoryDetail(${JSON.stringify(report).replace(/"/g, '&quot;')})">
                <div style="width: 120px; height: 120px; border-radius: 8px; overflow: hidden; background: ${photoPlaceholderBg}; flex-shrink: 0;">
                    ${report.photo_url ? `<img src="${report.photo_url}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: ${photoPlaceholderText}; font-size: 12px;">Fotoğraf Yok</div>`}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: ${labelColor};">Konteyner #${report.container_id}</div>
                    <div style="font-size: 14px; margin-bottom: 5px; color: ${textColor};">
                        <strong style="color: ${labelColor};">Sistem Tahmini:</strong> ${(report.system_fill_level * 100).toFixed(0)}%
                    </div>
                    <div style="font-size: 14px; margin-bottom: 5px; color: ${textColor};">
                        <strong style="color: ${labelColor};">Kullanıcı Bildirdiği:</strong> ${(report.reported_fill_level * 100).toFixed(0)}%
                    </div>
                    <div style="font-size: 14px; margin-bottom: 5px; color: ${textColor};">
                        <strong style="color: ${labelColor};">Durum:</strong> ${report.report_status === 1 ? `<span style="background: ${approvedBg}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: 600;">✅ Onaylandı</span>` : `<span style="background: ${rejectedBg}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: 600;">❌ Reddedildi</span>`}
                    </div>
                    <div style="font-size: 13px; color: ${notesColor};">
                        ${report.notes ? `<strong style="color: ${labelColor};">Not:</strong> ${report.notes.substring(0, 50)}${report.notes.length > 50 ? '...' : ''}` : 'Not yok'}
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (e) {
        console.error('Geçmiş yükleme hatası:', e);
        document.getElementById('historyList').innerHTML = '<div style="color: red;">Hata: Geçmiş yüklerken sorun oluştu</div>';
    }
}

function showHistoryDetail(report) {
    const detailPanel = document.getElementById('historyDetailPanel');
    const isDarkMode = document.body.classList.contains('admin-dark-mode');
    const approvedBg = '#00A651';
    const rejectedBg = '#E74C3C';
    
    document.getElementById('detailPhoto').src = report.photo_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EFotoğraf Yok%3C/text%3E%3C/svg%3E';
    document.getElementById('detailContainerId').textContent = report.container_id;
    document.getElementById('detailSystemFill').textContent = (report.system_fill_level * 100).toFixed(0) + '%';
    document.getElementById('detailUserFill').textContent = (report.reported_fill_level * 100).toFixed(0) + '%';
    document.getElementById('detailNotes').textContent = report.notes || 'Kullanıcı notu yok';
    document.getElementById('detailUserName').textContent = report.user_name;
    document.getElementById('detailNeighborhood').textContent = report.neighborhood;
    document.getElementById('detailStatus').innerHTML = report.report_status === 1 ? `<span style="background: ${approvedBg}; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600;">✅ Onaylandı</span>` : `<span style="background: ${rejectedBg}; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600;">❌ Reddedildi</span>`;
    
    detailPanel.style.display = 'block';
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeHistoryDetail() {
    document.getElementById('historyDetailPanel').style.display = 'none';
}

function filterHistory(status) {
    loadHistoryReports(status);
}

// ============== CONTAINER-BASED HISTORY ==============
let currentContainerId = null;
let currentContainerReports = [];

async function searchContainerHistory() {
    const containerId = document.getElementById('containerSearchInput').value.trim();
    
    if (!containerId) {
        alert('Lütfen bir Konteyner ID girin');
        return;
    }
    
    currentContainerId = parseInt(containerId);
    
    if (isNaN(currentContainerId)) {
        alert('Lütfen geçerli bir sayı girin');
        return;
    }
    
    try {
        const res = await fetch(`/api/admin/report-history?container_id=${currentContainerId}&status=all`);
        const data = await res.json();
        
        currentContainerReports = data.reports;
        
        // UI'ı güncelle
        if (currentContainerReports.length === 0) {
            document.getElementById('selectedContainerInfo').style.display = 'none';
            document.getElementById('containerTabsContainer').style.display = 'none';
            document.getElementById('historyPlaceholder').style.display = 'block';
            document.getElementById('historyPlaceholder').innerHTML = `<p>❌ Konteyner ${currentContainerId} için bildirim bulunamadı</p>`;
            return;
        }
        
        // Seçilmiş konteyner bilgilerini göster
        document.getElementById('selectedContainerId').textContent = `#${currentContainerId}`;
        if (currentContainerReports.length > 0) {
            document.getElementById('selectedContainerType').textContent = currentContainerReports[0].container_type;
        }
        document.getElementById('selectedContainerInfo').style.display = 'block';
        document.getElementById('historyPlaceholder').style.display = 'none';
        document.getElementById('containerTabsContainer').style.display = 'block';
        
        // Tarih sekmeleri oluştur
        createDateTabs(currentContainerReports);
        
        // Raporları render et
        filterContainerReports();
    } catch (e) {
        console.error('Konteyner araması hatası:', e);
        alert('❌ Hata: Konteyner araması sırasında sorun oluştu');
    }
}

function createDateTabs(reports) {
    const dateTabs = document.getElementById('dateTabs');
    dateTabs.innerHTML = '';
    
    // Benzersiz tarihleri al
    const dates = [];
    reports.forEach(r => {
        const date = new Date(r.created_at).toLocaleDateString('tr-TR');
        if (!dates.includes(date)) {
            dates.push(date);
        }
    });
    
    // Her tarih için sekme oluştur
    dates.forEach((date, index) => {
        const tab = document.createElement('button');
        tab.className = 'container-date-tab';
        if (index === 0) {
            tab.classList.add('active-date-tab');
        }
        tab.setAttribute('data-date', date);
        tab.onclick = function() {
            switchDateTab(this);
        };
        tab.textContent = `📅 ${date}`;
        dateTabs.appendChild(tab);
    });
}

function switchDateTab(tabElement) {
    // Önceki aktif sekmeyi deactive et - class'ı kaldır
    document.querySelectorAll('.container-date-tab').forEach(t => {
        t.classList.remove('active-date-tab');
    });
    
    // Şu anki sekmeyi active yap - class'ı ekle
    tabElement.classList.add('active-date-tab');
    
    filterContainerReports();
}


function filterContainerReports() {
    const activeTab = document.querySelector('.container-date-tab.active-date-tab');
    const selectedDate = activeTab?.getAttribute('data-date') || 'all';
    const statusFilter = document.querySelector('input[name="containerStatusFilter"]:checked')?.value || 'all';
    
    let filtered = currentContainerReports;
    
    // Tarihe göre filtrele
    if (selectedDate !== 'all') {
        filtered = filtered.filter(r => {
            const date = new Date(r.created_at).toLocaleDateString('tr-TR');
            return date === selectedDate;
        });
    }
    
    // Statüye göre filtrele
    if (statusFilter === 'approved') {
        filtered = filtered.filter(r => r.report_status === 1);
    } else if (statusFilter === 'rejected') {
        filtered = filtered.filter(r => r.report_status === -1);
    }
    
    renderContainerReports(filtered);
}

function renderContainerReports(reports) {
    const list = document.getElementById('containerReportsList');
    const isDarkMode = document.body.classList.contains('admin-dark-mode');
    const cardBg = isDarkMode ? '#2a3f5f' : '#f8f9fa';
    const cardBorder = isDarkMode ? '#3d5580' : '#ddd';
    const textColor = isDarkMode ? '#e0e0e0' : '#333';
    const labelColor = isDarkMode ? '#66c2ff' : '#0066B3';
    const photoPlaceholderBg = isDarkMode ? '#1f2d3d' : '#f0f0f0';
    const photoPlaceholderText = isDarkMode ? '#888' : '#999';
    const approvedBg = '#00A651';
    const rejectedBg = '#E74C3C';
    
    if (reports.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 30px; color: ${isDarkMode ? '#888' : '#666'};">Seçili tarihe ait rapor bulunamadı</div>`;
        return;
    }
    
    list.innerHTML = reports.map((report, idx) => `
        <div class="history-report-card" style="background: ${cardBg}; border: 2px solid ${cardBorder}; border-radius: 8px; padding: 15px; margin-bottom: 15px; cursor: pointer; transition: all 0.3s; display: flex; gap: 15px; align-items: center;" 
             onclick="showReportPhoto('${report.photo_url}', '${report.container_id}')">
            <div style="width: 120px; height: 120px; border-radius: 8px; overflow: hidden; background: ${photoPlaceholderBg}; flex-shrink: 0;">
                ${report.photo_url ? `<img src="${report.photo_url}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: ${photoPlaceholderText}; font-size: 12px;">Fotoğraf Yok</div>`}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 8px; color: ${labelColor};">Konteyner #${report.container_id}</div>
                <div style="font-size: 14px; margin-bottom: 5px; color: ${textColor};">
                    <strong style="color: ${labelColor};">Sistem Tahmini:</strong> ${(report.system_fill_level * 100).toFixed(0)}%
                </div>
                <div style="font-size: 14px; margin-bottom: 5px; color: ${textColor};">
                    <strong style="color: ${labelColor};">Kullanıcı Bildirdiği:</strong> ${(report.reported_fill_level * 100).toFixed(0)}%
                </div>
                <div style="font-size: 14px; margin-bottom: 5px; color: ${textColor};">
                    <strong style="color: ${labelColor};">Durum:</strong> ${report.report_status === 1 ? `<span style="background: ${approvedBg}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: 600;">✅ Onaylandı</span>` : `<span style="background: ${rejectedBg}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: 600;">❌ Reddedildi</span>`}
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#ccc' : '#666'};">
                    ${report.notes ? `<strong style="color: ${labelColor};">Not:</strong> ${report.notes.substring(0, 50)}${report.notes.length > 50 ? '...' : ''}` : 'Not yok'}
                </div>
            </div>
        </div>
    `).join('');
}

function showReportPhoto(photoUrl, containerId) {
    const isDarkMode = document.body.classList.contains('admin-dark-mode');
    const modalBg = isDarkMode ? '#1a1a1a' : '#fff';
    const closeBtnColor = isDarkMode ? '#e0e0e0' : '#333';
    
    // Simple modal for photo viewing
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: ${modalBg};
        border-radius: 8px;
        padding: 20px;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 28px;
        color: ${closeBtnColor};
        cursor: pointer;
    `;
    closeBtn.onclick = () => modal.remove();
    
    const title = document.createElement('div');
    title.textContent = `Konteyner #${containerId} - Fotoğraf`;
    title.style.cssText = `
        font-weight: 600;
        margin-bottom: 15px;
        color: ${isDarkMode ? '#e0e0e0' : '#333'};
    `;
    
    const img = document.createElement('img');
    img.src = photoUrl;
    img.style.cssText = `
        max-width: 100%;
        max-height: 70vh;
        border-radius: 4px;
    `;
    
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(img);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

function clearContainerSearch() {
    document.getElementById('containerSearchInput').value = '';
    document.getElementById('selectedContainerInfo').style.display = 'none';
    document.getElementById('containerTabsContainer').style.display = 'none';
    document.getElementById('historyPlaceholder').style.display = 'block';
    document.getElementById('historyPlaceholder').innerHTML = '<p>🔍 Konteyner araması yaparak bildirileri görüntüleyin</p>';
    currentContainerId = null;
    currentContainerReports = [];
}

// ============== CONTAINER MANAGEMENT ==============
let neighborhoodsCache = [];

async function loadNeighborhoods() {
    if (neighborhoodsCache.length > 0) {
        // Cache'ten dropdownları doldur
        populateNeighborhoodSelects();
        return;
    }
    
    try {
        const res = await fetch('/api/admin/neighborhoods');
        const data = await res.json();
        neighborhoodsCache = data.neighborhoods;
        
        // Her iki dropdown'u doldur
        populateNeighborhoodSelects();
    } catch (e) {
        console.error('Mahalleler yüklenemedi:', e);
    }
    
    // Mevcut konteynırları listele
    try {
        const res = await fetch('/api/admin/containers-list');
        const data = await res.json();
        
        if (data.containers && data.containers.length > 0) {
            document.getElementById('containerCountInfo').textContent = `${data.total} Konteyner`;
            
            // İlk 5 örnek ID
            const examples = data.containers.slice(0, 5).map(c => c.id).join(', ');
            document.getElementById('containerExamplesInfo').textContent = examples;
        }
    } catch (e) {
        console.error('Konteyner listesi yüklenemedi:', e);
    }
}

function populateNeighborhoodSelects() {
    // Düzenleme formu dropdown'u
    const editSelect = document.getElementById('editContainerNeighborhood');
    if (editSelect) {
        editSelect.innerHTML = '<option value="">Mahalle seçiniz...</option>';
        neighborhoodsCache.forEach(n => {
            const option = document.createElement('option');
            option.value = n.id;
            option.textContent = n.name;
            editSelect.appendChild(option);
        });
    }
    
    // Ekleme formu dropdown'u
    const addSelect = document.getElementById('addContainerNeighborhood');
    if (addSelect) {
        addSelect.innerHTML = '<option value="">Mahalle seçiniz...</option>';
        neighborhoodsCache.forEach(n => {
            const option = document.createElement('option');
            option.value = n.id;
            option.textContent = n.name;
            addSelect.appendChild(option);
        });
    }
}

async function searchContainerForUpdate() {
    const containerId = document.getElementById('containerUpdateSearchInput').value.trim();
    
    if (!containerId) {
        alert('Lütfen bir Konteyner ID girin');
        return;
    }
    
    try {
        const res = await fetch(`/api/admin/container/${containerId}`);
        const data = await res.json();
        
        if (!res.ok) {
            alert(`❌ ${data.error || 'Konteyner bulunamadı'}`);
            return;
        }
        
        const container = data;
        currentEditContainerId = container.container_id;
        
        // Mahalleler yükle
        await loadNeighborhoods();
        
        // Form'u doldur
        document.getElementById('editContainerId').textContent = container.container_id;
        document.getElementById('editContainerType').value = container.container_type;
        document.getElementById('editContainerCapacity').value = container.capacity_liters;
        document.getElementById('editContainerNeighborhood').value = container.neighborhood_id;
        document.getElementById('editContainerFillLevel').value = `${(container.current_fill_level * 100).toFixed(0)}%`;
        document.getElementById('editContainerStatus').value = container.status || 'active';
        
        // Panel'i göster
        document.getElementById('containerEditPanel').style.display = 'block';
        document.getElementById('containerUpdatePlaceholder').style.display = 'none';
        document.getElementById('containerAddPanel').style.display = 'none';
    } catch (e) {
        console.error('Konteyner araması hatası:', e);
        alert('❌ Hata: ' + e.message);
    }
}

function clearContainerUpdateSearch() {
    document.getElementById('containerUpdateSearchInput').value = '';
    document.getElementById('containerEditPanel').style.display = 'none';
    document.getElementById('containerAddPanel').style.display = 'none';
    document.getElementById('containerUpdatePlaceholder').style.display = 'block';
    currentEditContainerId = null;
}

async function saveContainerUpdates() {
    const containerId = document.getElementById('editContainerId').textContent;
    const containerType = document.getElementById('editContainerType').value;
    const capacity = document.getElementById('editContainerCapacity').value;
    const neighborhoodId = document.getElementById('editContainerNeighborhood').value;
    
    if (!containerType || !capacity || !neighborhoodId) {
        alert('❌ Lütfen tüm alanları doldurun');
        return;
    }
    
    try {
        const res = await fetch('/api/admin/update-container', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                container_id: parseInt(containerId),
                container_type: containerType,
                capacity_liters: parseInt(capacity),
                neighborhood_id: parseInt(neighborhoodId),
                status: 'active'
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert('✅ Konteyner başarıyla güncellendi!');
            addLog('Konteyner Güncelleme', containerId, `Tür: ${containerType}, Kapasite: ${capacity}lt`, 'Başarılı');
            clearContainerUpdateSearch();
        } else {
            alert('❌ Hata: ' + data.error);
            addLog('Konteyner Güncelleme', containerId, 'Hata oluştu', 'Başarısız');
        }
    } catch (e) {
        console.error('Güncelleme hatası:', e);
        alert('❌ Hata: ' + e.message);
        addLog('Konteyner Güncelleme', containerId, 'Ağ hatası', 'Başarısız');
    }
}

// ============== ADD/DELETE CONTAINER ==============
let currentEditContainerId = null;

function showAddContainerForm() {
    document.getElementById('containerAddPanel').style.display = 'block';
    document.getElementById('containerEditPanel').style.display = 'none';
    document.getElementById('containerUpdateSearchInput').value = '';
    
    // Formu temizle
    document.getElementById('addContainerType').value = '';
    document.getElementById('addContainerCapacity').value = '';
    document.getElementById('addContainerNeighborhood').value = '';
    document.getElementById('addContainerLat').value = '';
    document.getElementById('addContainerLon').value = '';
    
    // Mahalleleri yükle
    loadNeighborhoods();
}

function cancelAddContainerForm() {
    document.getElementById('containerAddPanel').style.display = 'none';
    document.getElementById('containerUpdatePlaceholder').style.display = 'block';
}

async function saveNewContainer() {
    const containerType = document.getElementById('addContainerType').value.trim();
    const capacity = document.getElementById('addContainerCapacity').value;
    const neighborhoodId = document.getElementById('addContainerNeighborhood').value;
    const lat = document.getElementById('addContainerLat').value || 0;
    const lon = document.getElementById('addContainerLon').value || 0;
    
    if (!containerType || !capacity || !neighborhoodId) {
        alert('❌ Lütfen Tür, Kapasite ve Mahalle alanlarını doldurun');
        return;
    }
    
    try {
        const res = await fetch('/api/admin/add-container', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                container_type: containerType,
                capacity_liters: parseInt(capacity),
                neighborhood_id: parseInt(neighborhoodId),
                location_lat: parseFloat(lat) || 0,
                location_lon: parseFloat(lon) || 0
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            const newContainerId = data.container_id;
            alert(`✅ Konteyner #${newContainerId} başarıyla oluşturuldu!\n(Türü: ${containerType}, Kapasite: ${capacity}lt, Doluluk: 0%)`);
            
            // Log işlemi
            addLog('Konteyner Ekleme', newContainerId, `Tür: ${containerType}, Kapasite: ${capacity}lt`, 'Başarılı');
            
            // Yeni konteyneri otomatik ara ve göster
            document.getElementById('containerUpdateSearchInput').value = newContainerId;
            document.getElementById('containerEditPanel').style.display = 'none';
            document.getElementById('containerAddPanel').style.display = 'none';
            document.getElementById('containerUpdatePlaceholder').style.display = 'none';
            
            // Biraz gecikmeyle search yap (form kapanması için)
            setTimeout(() => {
                searchContainerForUpdate();
            }, 100);
            
            // Mahalleleri yeniden yükle (konteyner sayısını güncellemek için)
            neighborhoodsCache = [];
            loadNeighborhoods();
        } else {
            alert('❌ Hata: ' + data.error);
        }
    } catch (e) {
        console.error('Konteyner ekleme hatası:', e);
        alert('❌ Hata: ' + e.message);
    }
}

function deleteCurrentContainer() {
    const containerId = document.getElementById('editContainerId').textContent;
    
    if (!containerId) {
        alert('❌ Silinecek konteyner yok');
        return;
    }
    
    if (!confirm(`⚠️  Konteyner #${containerId} silinecek. Emin misiniz?`)) {
        return;
    }
    
    deleteContainer(containerId);
}

async function deleteContainer(containerId) {
    try {
        const res = await fetch(`/api/admin/delete-container/${containerId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(`✅ Konteyner #${containerId} silindi!`);
            addLog('Konteyner Silme', containerId, 'Edit panelinden silindi', 'Başarılı');
            clearContainerUpdateSearch();
            
            // Mahalleleri yeniden yükle (konteyner sayısını güncellemek için)
            neighborhoodsCache = [];
            loadNeighborhoods();
        } else {
            alert('❌ Hata: ' + data.error);
            addLog('Konteyner Silme', containerId, 'Hata oluştu', 'Başarısız');
        }
    } catch (e) {
        console.error('Konteyner silme hatası:', e);
        alert('❌ Hata: ' + e.message);
        addLog('Konteyner Silme', containerId, 'Ağ hatası', 'Başarısız');
    }
}

// ============== ADMIN LOGS MANAGEMENT ==============
function addLog(operation, containerId, details, status = 'Başarılı') {
    const timestamp = new Date().toLocaleString('tr-TR');
    const log = {
        id: Date.now(),
        timestamp,
        operation,
        containerId,
        details,
        status
    };
    
    let logs = JSON.parse(localStorage.getItem('adminLogs') || '[]');
    logs.unshift(log); // En yenesi başa gelsin
    localStorage.setItem('adminLogs', JSON.stringify(logs));
    
    displayLogs();
}

async function displayLogs() {
    try {
        const res = await fetch('/api/admin/logs');
        const data = await res.json();
        
        const logsList = document.getElementById('adminLogsList');
        const isDarkMode = document.body.classList.contains('admin-dark-mode');
        const textColor = isDarkMode ? '#FFFFFF' : '#333333';
        const bgColor = isDarkMode ? '#1a1a1a' : 'white';
        const borderSubtle = isDarkMode ? '#444444' : '#ddd';
        
        if (!data.logs || data.logs.length === 0) {
            logsList.innerHTML = `<p style="text-align: center; color: ${textColor};">Henüz işlem kaydı yok</p>`;
            return;
        }
        
        let html = '';
        data.logs.forEach(log => {
            const actionType = log.action === 'APPROVE_REPORT' ? 'ONAYLANDI' : log.action === 'REJECT_REPORT' ? 'REDDEDILDI' : log.action;
            const statusColor = log.action === 'APPROVE_REPORT' ? '#00A651' : log.action === 'REJECT_REPORT' ? '#E74C3C' : '#FFA500';
            const statusEmoji = log.action === 'APPROVE_REPORT' ? '✅' : log.action === 'REJECT_REPORT' ? '❌' : '⚙️';
            
            html += `
                <div style="border-left: 4px solid ${statusColor}; padding: 12px 15px; margin-bottom: 10px; background: ${bgColor}; border-radius: 4px; border: 1px solid ${borderSubtle}; color: ${textColor};">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong style="color: ${statusColor};">${statusEmoji} Rapor #${log.report_id}</strong><br>
                            <small style="color: ${isDarkMode ? '#aaa' : '#999'};">${new Date(log.timestamp).toLocaleString('tr-TR')}</small><br>
                            <span style="font-size: 13px; color: ${isDarkMode ? '#ccc' : '#666'};">
                                Kullanıcı ID: <strong>${log.target_user_id}</strong> | Konteyner: <strong>${log.target_container_id || 'N/A'}</strong>
                            </span>
                        </div>
                        <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px; white-space: nowrap;">
                            ${actionType}
                        </span>
                    </div>
                </div>
            `;
        });
        
        logsList.innerHTML = html;
    } catch (e) {
        console.error('Logs load error:', e);
        document.getElementById('adminLogsList').innerHTML = '<div style="color: red; padding: 20px;">Hata: İşlem kayıtları yüklenemedi</div>';
    }
}

function clearAllLogs() {
    if (confirm('⚠️ Tüm işlem kayıtları silinecek. Emin misiniz?')) {
        // Backend'de temizleme işlemi yapılabilir (optional)
        alert('✅ Temizleme işlemi uygulanamıyor - kayıtlar korunuyor!');
    }
}

async function deleteContainerDirect() {
    const containerId = document.getElementById('deleteContainerId').value;
    
    if (!containerId) {
        alert('❌ Lütfen Konteyner ID giriniz');
        return;
    }
    
    if (!confirm(`⚠️ Konteyner #${containerId} silinecek. Emin misiniz?`)) {
        return;
    }
    
    try {
        const res = await fetch(`/api/admin/delete-container/${containerId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(`✅ Konteyner #${containerId} silindi!`);
            addLog('Konteyner Silme', containerId, 'Silme panelinden silindi', 'Başarılı');
            document.getElementById('deleteContainerId').value = '';
            
            // Mahalleleri yeniden yükle
            neighborhoodsCache = [];
            loadNeighborhoods();
            
            // Arama alanını temizle
            clearContainerUpdateSearch();
        } else {
            alert('❌ Hata: ' + data.error);
            addLog('Konteyner Silme', containerId, 'Hata oluştu', 'Başarısız');
        }
    } catch (e) {
        console.error('Konteyner silme hatası:', e);
        alert('❌ Hata: ' + e.message);
        addLog('Konteyner Silme', containerId, 'Ağ hatası', 'Başarısız');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dark mode
    initAdminDarkMode();
    
    // Load pending reports on page load
    loadPendingReports();
    
    // Load logs on page load
    displayLogs();
    
    if (startDateInput) {
        startDateInput.value = today.toISOString().split('T')[0];
    }
    
    if (endDateInput) {
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30); // 30 days later
        endDateInput.value = endDate.toISOString().split('T')[0];
    }
    
    const fleetInputs = [
        { input: 'smallTruckChange', current: 5, total: 'smallTruckTotal' },
        { input: 'largeTruckChange', current: 10, total: 'largeTruckTotal' },
        { input: 'compactorChange', current: 3, total: 'compactorTotal' }
    ];
    
    fleetInputs.forEach(fleet => {
        const input = document.getElementById(fleet.input);
        const totalElement = document.getElementById(fleet.total);
        
        if (input && totalElement) {
            input.addEventListener('input', function() {
                const change = parseInt(this.value) || 0;
                const newTotal = fleet.current + change;
                totalElement.textContent = newTotal;
                
                // Highlight if changed
                if (change !== 0) {
                    totalElement.style.fontWeight = '700';
                    totalElement.style.color = change > 0 ? '#00A651' : '#E74C3C';
                } else {
                    totalElement.style.fontWeight = 'normal';
                    totalElement.style.color = 'inherit';
                }
            });
        }
    });
});

// ============== SIMULATION ENGINE ==============
async function runSimulation() {
    const button = document.querySelector('.run-simulation-btn');
    const resultsPanel = document.getElementById('resultsPanel');
    
    // Get input values
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const simName = document.getElementById('simName').value || 'Adsız Simülasyon';
    
    const fleetChanges = {
        small_trucks: parseInt(document.getElementById('smallTruckChange').value) || 0,
        large_trucks: parseInt(document.getElementById('largeTruckChange').value) || 0,
        compactors: parseInt(document.getElementById('compactorChange').value) || 0
    };
    
    const parameters = {
        fuel_price: parseFloat(document.getElementById('fuelPrice').value) || 44.50,
        max_route_duration: parseInt(document.getElementById('maxRouteDuration').value) || 8
    };
    
    // Validate
    if (!startDate || !endDate) {
        alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
        return;
    }
    
    // Calculate days between dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) {
        alert('Bitiş tarihi başlangıç tarihinden sonra olmalıdır.');
        return;
    }
    
    parameters.days = daysDiff;
    
    // Show loading state
    button.disabled = true;
    button.textContent = 'Gerçek Veriler Analiz Ediliyor...';
    resultsPanel.classList.remove('visible');
    
    try {
        // Gerçek verilerle simülasyon hesapla
        const results = await calculateSimulation(fleetChanges, parameters);
        
        // Display results
        displayResults(results);
        
        // Gerçek veri kullanıldığını göster
        if (results.real_data) {
            console.log('✓ Simülasyon gerçek API verileriyle hesaplandı');
        } else {
            console.log('⚠ Simülasyon fallback verileriyle hesaplandı');
        }
        
        // Show results panel
        resultsPanel.classList.add('visible');
        
        // Scroll to results
        resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (error) {
        console.error('Simülasyon hatası:', error);
        alert('Simülasyon sırasında bir hata oluştu.');
    } finally {
        // Reset button
        button.disabled = false;
        button.textContent = 'Simülasyonu Çalıştır';
    }
}

// ============== SIMULATION CALCULATIONS WITH REAL DATA ==============
async function calculateSimulation(fleetChanges, parameters) {
    // Gerçek veritabanı verilerini API'den çek
    try {
        const statsResponse = await fetch('/api/dashboard/stats');
        const stats = await statsResponse.json();
        
        const fleetResponse = await fetch('/api/fleet/summary');
        const fleetData = await fleetResponse.json();
        
        const tonnageResponse = await fetch('/api/tonnage/monthly');
        const tonnageData = await tonnageResponse.json();
        
        // Gerçek filo bilgileri
        const currentFleet = {
            small_trucks: fleetData?.small_trucks || 5,
            large_trucks: fleetData?.large_trucks || 20,
            crane_vehicles: fleetData?.crane_vehicles || 10
        };
        
        // Gerçek günlük ortalama değerler (veritabanından)
        const avgDailyTonnage = tonnageData?.avg_daily_tonnage || 550; // ton/gün
        const avgDailyKm = tonnageData?.avg_daily_km || 180; // km/gün
        
        // Gerçek araç verimliliği ve maliyetleri
        const vehicleSpecs = {
            small: { 
                capacity_tons: 4.5, 
                fuel_per_km: 0.20, 
                co2_per_km: 0.52,
                daily_maintenance: 150,  // TL/gün bakım
                daily_driver_cost: 800   // TL/gün şoför
            },
            large: { 
                capacity_tons: 8.0, 
                fuel_per_km: 0.35, 
                co2_per_km: 0.91,
                daily_maintenance: 250,
                daily_driver_cost: 900
            },
            crane: { 
                capacity_tons: 11.5, 
                fuel_per_km: 0.45, 
                co2_per_km: 1.17,
                daily_maintenance: 350,
                daily_driver_cost: 1000
            }
        };
        
        // Gerçek yakıt fiyatı ve parametreler
        const days = parameters.days || 30;
        const fuelPrice = parameters.fuel_price || 44.50; // TL/L gerçek fiyat
        
        // Her araç tipi için günlük ortalama km (dağılım ağırlıklı)
        const dailyKmPerVehicle = {
            small: avgDailyKm * 0.8,  // Küçük araçlar daha az km
            large: avgDailyKm * 1.0,  // Büyük araçlar normal
            crane: avgDailyKm * 0.6   // Vinçli araçlar en az
        };
        
        // ===== BASELINE (MEVCUT DURUM) HESAPLAMA =====
        const baselineFuelPerDay = 
            currentFleet.small_trucks * dailyKmPerVehicle.small * vehicleSpecs.small.fuel_per_km +
            currentFleet.large_trucks * dailyKmPerVehicle.large * vehicleSpecs.large.fuel_per_km +
            currentFleet.crane_vehicles * dailyKmPerVehicle.crane * vehicleSpecs.crane.fuel_per_km;
        
        const baselineCO2PerDay = 
            currentFleet.small_trucks * dailyKmPerVehicle.small * vehicleSpecs.small.co2_per_km +
            currentFleet.large_trucks * dailyKmPerVehicle.large * vehicleSpecs.large.co2_per_km +
            currentFleet.crane_vehicles * dailyKmPerVehicle.crane * vehicleSpecs.crane.co2_per_km;
        
        const baselineKmPerDay = 
            currentFleet.small_trucks * dailyKmPerVehicle.small +
            currentFleet.large_trucks * dailyKmPerVehicle.large +
            currentFleet.crane_vehicles * dailyKmPerVehicle.crane;
        
        const baselineMaintenancePerDay = 
            currentFleet.small_trucks * vehicleSpecs.small.daily_maintenance +
            currentFleet.large_trucks * vehicleSpecs.large.daily_maintenance +
            currentFleet.crane_vehicles * vehicleSpecs.crane.daily_maintenance;
        
        const baselinePersonnelPerDay = 
            currentFleet.small_trucks * vehicleSpecs.small.daily_driver_cost +
            currentFleet.large_trucks * vehicleSpecs.large.daily_driver_cost +
            currentFleet.crane_vehicles * vehicleSpecs.crane.daily_driver_cost;
        
        const baselineFuelCostPerDay = baselineFuelPerDay * fuelPrice;
        const baselineTotalCostPerDay = baselineFuelCostPerDay + baselineMaintenancePerDay + baselinePersonnelPerDay;
        
        const baselineCapacity = 
            currentFleet.small_trucks * vehicleSpecs.small.capacity_tons +
            currentFleet.large_trucks * vehicleSpecs.large.capacity_tons +
            currentFleet.crane_vehicles * vehicleSpecs.crane.capacity_tons;
        
        const baseline = {
            km_driven: Math.round(baselineKmPerDay * days),
            fuel_consumed: Math.round(baselineFuelPerDay * days),
            co2_emissions: Math.round(baselineCO2PerDay * days),
            cost: Math.round(baselineTotalCostPerDay * days),
            collection_rate: 100,
            satisfaction: 95,
            routes: Math.round((currentFleet.small_trucks + currentFleet.large_trucks + currentFleet.crane_vehicles) * 1.5 * days),
            tonnage: Math.round(avgDailyTonnage * days * 1000) // kg cinsinden
        };
        
        // ===== SİMÜLE EDİLEN DURUM (YENİ FİLO) =====
        const newSmall = Math.max(0, currentFleet.small_trucks + fleetChanges.small_trucks);
        const newLarge = Math.max(0, currentFleet.large_trucks + fleetChanges.large_trucks);
        const newCrane = Math.max(0, currentFleet.crane_vehicles + fleetChanges.compactors);
        const totalVehicles = newSmall + newLarge + newCrane;
        const baselineTotalVehicles = currentFleet.small_trucks + currentFleet.large_trucks + currentFleet.crane_vehicles;
        
        // Yeni filo kapasitesi
        const newCapacity = 
            newSmall * vehicleSpecs.small.capacity_tons +
            newLarge * vehicleSpecs.large.capacity_tons +
            newCrane * vehicleSpecs.crane.capacity_tons;
        
        // Kapasite oranı - toplama ihtiyacını karşılama durumu
        const capacityRatio = newCapacity / avgDailyTonnage;
        
        // Yeni filo günlük yakıt tüketimi
        const simFuelPerDay = 
            newSmall * dailyKmPerVehicle.small * vehicleSpecs.small.fuel_per_km +
            newLarge * dailyKmPerVehicle.large * vehicleSpecs.large.fuel_per_km +
            newCrane * dailyKmPerVehicle.crane * vehicleSpecs.crane.fuel_per_km;
        
        // Yeni filo günlük CO2
        const simCO2PerDay = 
            newSmall * dailyKmPerVehicle.small * vehicleSpecs.small.co2_per_km +
            newLarge * dailyKmPerVehicle.large * vehicleSpecs.large.co2_per_km +
            newCrane * dailyKmPerVehicle.crane * vehicleSpecs.crane.co2_per_km;
        
        // Yeni filo günlük km
        const simKmPerDay = 
            newSmall * dailyKmPerVehicle.small +
            newLarge * dailyKmPerVehicle.large +
            newCrane * dailyKmPerVehicle.crane;
        
        // Yeni filo günlük bakım maliyeti
        const simMaintenancePerDay = 
            newSmall * vehicleSpecs.small.daily_maintenance +
            newLarge * vehicleSpecs.large.daily_maintenance +
            newCrane * vehicleSpecs.crane.daily_maintenance;
        
        // Yeni filo günlük personel maliyeti
        const simPersonnelPerDay = 
            newSmall * vehicleSpecs.small.daily_driver_cost +
            newLarge * vehicleSpecs.large.daily_driver_cost +
            newCrane * vehicleSpecs.crane.daily_driver_cost;
        
        // Yeni filo günlük yakıt maliyeti
        const simFuelCostPerDay = simFuelPerDay * fuelPrice;
        
        // Yeni filo toplam günlük maliyet
        const simTotalCostPerDay = simFuelCostPerDay + simMaintenancePerDay + simPersonnelPerDay;
        
        // Toplama oranı - kapasite yetersizse düşer
        const collectionRate = Math.min(100, Math.round(capacityRatio * 100));
        
        // Memnuniyet - kapasite düşerse hizmet kalitesi düşer
        let satisfaction = 95;
        if (capacityRatio < 1.0) {
            satisfaction = Math.round(95 * capacityRatio); // Kapasite yetersizse memnuniyet düşer
        } else if (capacityRatio > 1.2) {
            satisfaction = 97; // Fazla kapasite biraz memnuniyet artırır
        }
        
        const simulated = {
            km_driven: Math.round(simKmPerDay * days),
            fuel_consumed: Math.round(simFuelPerDay * days),
            co2_emissions: Math.round(simCO2PerDay * days),
            cost: Math.round(simTotalCostPerDay * days),
            collection_rate: collectionRate,
            satisfaction: satisfaction,
            routes: Math.round(totalVehicles * 1.5 * days),
            tonnage: Math.round(Math.min(avgDailyTonnage, newCapacity) * days * 1000) // Kapasite kadar toplanabilir
        };
        
        // Değişim hesaplamaları
        const changes = {
            km: simulated.km_driven - baseline.km_driven,
            fuel: simulated.fuel_consumed - baseline.fuel_consumed,
            co2: simulated.co2_emissions - baseline.co2_emissions,
            cost: simulated.cost - baseline.cost,
            collection_rate: simulated.collection_rate - baseline.collection_rate,
            satisfaction: simulated.satisfaction - baseline.satisfaction,
            routes: simulated.routes - baseline.routes,
            tonnage: simulated.tonnage - baseline.tonnage
        };
        
        const percentages = {
            km: ((changes.km / baseline.km_driven) * 100).toFixed(1),
            fuel: ((changes.fuel / baseline.fuel_consumed) * 100).toFixed(1),
            co2: ((changes.co2 / baseline.co2_emissions) * 100).toFixed(1),
            cost: ((changes.cost / baseline.cost) * 100).toFixed(1),
            collection_rate: (changes.collection_rate).toFixed(1),
            routes: ((changes.routes / baseline.routes) * 100).toFixed(1),
            tonnage: ((changes.tonnage / baseline.tonnage) * 100).toFixed(1)
        };
        
        const recommendation = generateRecommendation(changes, 
            fleetChanges.small_trucks + fleetChanges.large_trucks + fleetChanges.compactors, days);
        
        return {
            baseline,
            simulated,
            changes,
            percentages,
            recommendation,
            fleetChanges,
            days,
            real_data: true
        };
        
    } catch (error) {
        console.error('Gerçek veri çekme hatası, fallback kullanılıyor:', error);
        // Fallback: Dosyadan okunan gerçek değerler
        return calculateSimulationFallback(fleetChanges, parameters);
    }
}

// Fallback fonksiyonu - API çalışmazsa CSV'deki gerçek verilerle hesapla
function calculateSimulationFallback(fleetChanges, parameters) {
    // Gerçek CSV verilerinden: tonnages.csv ortalaması
    const realMonthlyTonnage = 17000; // ton/ay (CSV ortalaması)
    const realDailyTonnage = realMonthlyTonnage / 30; // ~567 ton/gün
    
    // fleet.csv'den gerçek araç sayıları
    const currentFleet = {
        small_trucks: 5,  // Small Garbage Truck sayısı
        large_trucks: 20, // Large Garbage Truck sayısı  
        crane_vehicles: 20 // Crane Vehicle sayısı
    };
    
    // truck_types.csv'den gerçek kapasiteler ve maliyetler
    const vehicleSpecs = {
        small: { 
            capacity_tons: 4.5, 
            fuel_per_km: 0.20, 
            co2_per_km: 0.52,
            daily_maintenance: 150,
            daily_driver_cost: 800,
            daily_km: 144  // 180 * 0.8
        },
        large: { 
            capacity_tons: 8.0, 
            fuel_per_km: 0.35, 
            co2_per_km: 0.91,
            daily_maintenance: 250,
            daily_driver_cost: 900,
            daily_km: 180
        },
        crane: { 
            capacity_tons: 11.5, 
            fuel_per_km: 0.45, 
            co2_per_km: 1.17,
            daily_maintenance: 350,
            daily_driver_cost: 1000,
            daily_km: 108  // 180 * 0.6
        }
    };
    
    const days = parameters.days || 30;
    const fuelPrice = parameters.fuel_price || 44.50;
    
    // ===== BASELINE HESAPLAMA =====
    const baselineFuelPerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_km * vehicleSpecs.small.fuel_per_km +
        currentFleet.large_trucks * vehicleSpecs.large.daily_km * vehicleSpecs.large.fuel_per_km +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.fuel_per_km;
    
    const baselineCO2PerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_km * vehicleSpecs.small.co2_per_km +
        currentFleet.large_trucks * vehicleSpecs.large.daily_km * vehicleSpecs.large.co2_per_km +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.co2_per_km;
    
    const baselineKmPerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_km +
        currentFleet.large_trucks * vehicleSpecs.large.daily_km +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_km;
    
    const baselineMaintenancePerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_maintenance +
        currentFleet.large_trucks * vehicleSpecs.large.daily_maintenance +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_maintenance;
    
    const baselinePersonnelPerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_driver_cost +
        currentFleet.large_trucks * vehicleSpecs.large.daily_driver_cost +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_driver_cost;
    
    const baselineFuelCostPerDay = baselineFuelPerDay * fuelPrice;
    const baselineTotalCostPerDay = baselineFuelCostPerDay + baselineMaintenancePerDay + baselinePersonnelPerDay;
    
    const baselineCapacity = 
        currentFleet.small_trucks * vehicleSpecs.small.capacity_tons +
        currentFleet.large_trucks * vehicleSpecs.large.capacity_tons +
        currentFleet.crane_vehicles * vehicleSpecs.crane.capacity_tons;
    
    const baselineTotalVehicles = currentFleet.small_trucks + currentFleet.large_trucks + currentFleet.crane_vehicles;
    
    const baseline = {
        km_driven: Math.round(baselineKmPerDay * days),
        fuel_consumed: Math.round(baselineFuelPerDay * days),
        co2_emissions: Math.round(baselineCO2PerDay * days),
        cost: Math.round(baselineTotalCostPerDay * days),
        collection_rate: 100,
        satisfaction: 95,
        routes: Math.round(baselineTotalVehicles * 1.5 * days),
        tonnage: Math.round(realDailyTonnage * days * 1000)
    };
    
    // ===== YENİ FİLO İLE HESAPLAMA =====
    const newSmall = Math.max(0, currentFleet.small_trucks + fleetChanges.small_trucks);
    const newLarge = Math.max(0, currentFleet.large_trucks + fleetChanges.large_trucks);
    const newCrane = Math.max(0, currentFleet.crane_vehicles + fleetChanges.compactors);
    const totalVehicles = newSmall + newLarge + newCrane;
    
    // Yeni kapasite
    const newCapacity = 
        newSmall * vehicleSpecs.small.capacity_tons +
        newLarge * vehicleSpecs.large.capacity_tons +
        newCrane * vehicleSpecs.crane.capacity_tons;
    
    const capacityRatio = newCapacity / realDailyTonnage;
    
    // Yeni filo günlük değerleri
    const simFuelPerDay = 
        newSmall * vehicleSpecs.small.daily_km * vehicleSpecs.small.fuel_per_km +
        newLarge * vehicleSpecs.large.daily_km * vehicleSpecs.large.fuel_per_km +
        newCrane * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.fuel_per_km;
    
    const simCO2PerDay = 
        newSmall * vehicleSpecs.small.daily_km * vehicleSpecs.small.co2_per_km +
        newLarge * vehicleSpecs.large.daily_km * vehicleSpecs.large.co2_per_km +
        newCrane * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.co2_per_km;
    
    const simKmPerDay = 
        newSmall * vehicleSpecs.small.daily_km +
        newLarge * vehicleSpecs.large.daily_km +
        newCrane * vehicleSpecs.crane.daily_km;
    
    const simMaintenancePerDay = 
        newSmall * vehicleSpecs.small.daily_maintenance +
        newLarge * vehicleSpecs.large.daily_maintenance +
        newCrane * vehicleSpecs.crane.daily_maintenance;
    
    const simPersonnelPerDay = 
        newSmall * vehicleSpecs.small.daily_driver_cost +
        newLarge * vehicleSpecs.large.daily_driver_cost +
        newCrane * vehicleSpecs.crane.daily_driver_cost;
    
    const simFuelCostPerDay = simFuelPerDay * fuelPrice;
    const simTotalCostPerDay = simFuelCostPerDay + simMaintenancePerDay + simPersonnelPerDay;
    
    // Toplama oranı
    const collectionRate = Math.min(100, Math.round(capacityRatio * 100));
    
    // Memnuniyet
    let satisfaction = 95;
    if (capacityRatio < 1.0) {
        satisfaction = Math.round(95 * capacityRatio);
    } else if (capacityRatio > 1.2) {
        satisfaction = 97;
    }
    
    const simulated = {
        km_driven: Math.round(simKmPerDay * days),
        fuel_consumed: Math.round(simFuelPerDay * days),
        co2_emissions: Math.round(simCO2PerDay * days),
        cost: Math.round(simTotalCostPerDay * days),
        collection_rate: collectionRate,
        satisfaction: satisfaction,
        routes: Math.round(totalVehicles * 1.5 * days),
        tonnage: Math.round(Math.min(realDailyTonnage, newCapacity) * days * 1000)
    };
    
    const changes = {
        km: simulated.km_driven - baseline.km_driven,
        fuel: simulated.fuel_consumed - baseline.fuel_consumed,
        co2: simulated.co2_emissions - baseline.co2_emissions,
        cost: simulated.cost - baseline.cost,
        collection_rate: simulated.collection_rate - baseline.collection_rate,
        satisfaction: simulated.satisfaction - baseline.satisfaction,
        routes: simulated.routes - baseline.routes,
        tonnage: simulated.tonnage - baseline.tonnage
    };
    
    const percentages = {
        km: baseline.km_driven !== 0 ? ((changes.km / baseline.km_driven) * 100).toFixed(1) : '0.0',
        fuel: baseline.fuel_consumed !== 0 ? ((changes.fuel / baseline.fuel_consumed) * 100).toFixed(1) : '0.0',
        co2: baseline.co2_emissions !== 0 ? ((changes.co2 / baseline.co2_emissions) * 100).toFixed(1) : '0.0',
        cost: baseline.cost !== 0 ? ((changes.cost / baseline.cost) * 100).toFixed(1) : '0.0',
        collection_rate: (changes.collection_rate).toFixed(1),
        routes: baseline.routes !== 0 ? ((changes.routes / baseline.routes) * 100).toFixed(1) : '0.0',
        tonnage: baseline.tonnage !== 0 ? ((changes.tonnage / baseline.tonnage) * 100).toFixed(1) : '0.0'
    };
    
    const totalChange = fleetChanges.small_trucks + fleetChanges.large_trucks + fleetChanges.compactors;
    const recommendation = generateRecommendation(changes, totalChange, days);
    
    return {
        baseline,
        simulated,
        changes,
        percentages,
        recommendation,
        fleetChanges,
        days,
        real_data: false
    };
}

// ============== RECOMMENDATION ENGINE ==============
function generateRecommendation(changes, totalChange, days) {
    let score = 0;
    const reasons = [];
    const periodText = days === 1 ? '1 günlük' : `${days} günlük`;
    
    // Maliyet değerlendirmesi (en önemli faktör)
    if (changes.cost < 0) {
        score += 35;
        reasons.push(`${periodText} ${Math.abs(changes.cost).toLocaleString('tr-TR')} ₺ tasarruf sağlar`);
    } else if (changes.cost > 0) {
        score -= 25;
        reasons.push(`${periodText} ${Math.abs(changes.cost).toLocaleString('tr-TR')} ₺ ek maliyet getirir`);
    }
    
    // Yakıt tasarrufu
    if (changes.fuel < 0) {
        score += 15;
        reasons.push(`${Math.abs(changes.fuel).toLocaleString('tr-TR')} L yakıt tasarrufu`);
    } else if (changes.fuel > 0) {
        score -= 10;
        reasons.push(`${Math.abs(changes.fuel).toLocaleString('tr-TR')} L ek yakıt tüketimi`);
    }
    
    // Çevresel etki
    if (changes.co2 < 0) {
        score += 15;
        reasons.push(`${Math.abs(changes.co2).toLocaleString('tr-TR')} kg CO₂ emisyon azalması`);
    } else if (changes.co2 > 0) {
        score -= 10;
        reasons.push(`${Math.abs(changes.co2).toLocaleString('tr-TR')} kg CO₂ emisyon artışı`);
    }
    
    // Hizmet kalitesi - toplama oranı (kritik)
    if (changes.collection_rate >= 0) {
        score += 20;
        reasons.push('Hizmet kalitesi korunuyor veya artıyor');
    } else if (changes.collection_rate >= -5) {
        score += 5;
        reasons.push(`Hizmet kalitesinde minimal düşüş (%${Math.abs(changes.collection_rate).toFixed(1)})`);
    } else if (changes.collection_rate >= -15) {
        score -= 20;
        reasons.push(`Hizmet kalitesinde düşüş (%${Math.abs(changes.collection_rate).toFixed(1)})`);
    } else {
        score -= 40;
        reasons.push(`⚠️ Kritik: Hizmet kalitesinde ciddi düşüş (%${Math.abs(changes.collection_rate).toFixed(1)})`);
    }
    
    // Memnuniyet
    if (changes.satisfaction >= 0) {
        score += 10;
    } else if (changes.satisfaction < -5) {
        score -= 15;
        reasons.push(`Vatandaş memnuniyetinde düşüş (${changes.satisfaction} puan)`);
    }
    
    // Determine recommendation level
    let level, cssClass, action;
    
    if (score >= 60) {
        level = 'ŞIDDETLE TAVSİYE EDİLİR';
        cssClass = 'recommended';
        action = 'Bu filo konfigürasyonunu hemen uygulayın. Maliyet ve verimlilik optimum.';
    } else if (score >= 35) {
        level = 'TAVSİYE EDİLİR';
        cssClass = 'recommended';
        action = 'Bu değişiklik faydalı görünüyor. Uygulama öncesi detaylı analiz yapın.';
    } else if (score >= 10) {
        level = 'NÖTR';
        cssClass = 'neutral';
        action = 'Marjinal faydalar mevcut. İsteğe bağlı uygulama yapılabilir.';
    } else if (score >= -15) {
        level = 'DİKKATLİ OLUN';
        cssClass = 'neutral';
        action = 'Bu değişiklik bazı riskleri beraberinde getirir. Dikkatli değerlendirin.';
    } else {
        level = 'TAVSİYE EDİLMEZ';
        cssClass = 'not-recommended';
        action = 'Bu konfigürasyon hizmet kalitesini olumsuz etkiler. Uygulamayın.';
    }
    
    return {
        level,
        cssClass,
        action,
        score,
        reasons
    };
}

// ============== DISPLAY RESULTS ==============
function displayResults(results) {
    const { baseline, simulated, changes, percentages, recommendation } = results;
    
    // Update recommendation box
    const recBox = document.getElementById('recommendationBox');
    recBox.className = `recommendation-box ${recommendation.cssClass}`;
    
    document.getElementById('recommendationTitle').textContent = 
        `📊 TAVSİYE: ${recommendation.level}`;
    document.getElementById('recommendationText').textContent = 
        recommendation.action;
    
    // Update reasons list
    const reasonsList = document.getElementById('recommendationReasons');
    reasonsList.innerHTML = recommendation.reasons
        .map(reason => `<li>${reason}</li>`)
        .join('');
    
    // Update metric cards
    updateMetricCard('km', simulated.km_driven, changes.km, percentages.km);
    updateMetricCard('fuel', simulated.fuel_consumed, changes.fuel, percentages.fuel, 'L');
    updateMetricCard('co2', simulated.co2_emissions, changes.co2, percentages.co2, 'kg');
    updateMetricCard('cost', simulated.cost, changes.cost, percentages.cost, '₺');
    updateMetricCard('collectionRate', simulated.collection_rate.toFixed(1), changes.collection_rate, percentages.collection_rate, '%');
    updateMetricCard('satisfaction', simulated.satisfaction, changes.satisfaction, null);
    
    // Update detailed comparison table
    updateComparisonTable(baseline, simulated, changes, percentages);
}

function updateComparisonTable(baseline, simulated, changes, percentages) {
    const tbody = document.getElementById('comparisonTableBody');
    if (!tbody) return;
    
    const rows = [
        {
            label: 'Toplanan Atık (kg)',
            baseline: baseline.tonnage,
            simulated: simulated.tonnage,
            change: changes.tonnage,
            percentage: percentages.tonnage
        },
        {
            label: 'Toplam Kilometre',
            baseline: baseline.km_driven,
            simulated: simulated.km_driven,
            change: changes.km,
            percentage: percentages.km
        },
        {
            label: 'Yakıt Tüketimi (L)',
            baseline: baseline.fuel_consumed,
            simulated: simulated.fuel_consumed,
            change: changes.fuel,
            percentage: percentages.fuel
        }
    ];
    
    tbody.innerHTML = rows.map(row => {
        const changeClass = row.change < 0 ? 'positive' : 'negative';
        const changeSign = row.change >= 0 ? '+' : '';
        const changeText = `${changeSign}${row.change.toLocaleString('tr-TR')} (${changeSign}${row.percentage}%)`;
        
        return `
            <tr>
                <td>${row.label}</td>
                <td>${row.baseline.toLocaleString('tr-TR')}</td>
                <td>${row.simulated.toLocaleString('tr-TR')}</td>
                <td class="${changeClass}">${changeText}</td>
            </tr>
        `;
    }).join('');
}

function updateMetricCard(prefix, value, change, percentage, unit = '') {
    const valueElement = document.getElementById(`${prefix}Value`);
    const changeElement = document.getElementById(`${prefix}Change`);
    
    if (valueElement) {
        if (unit === '₺' || unit === '') {
            valueElement.textContent = `${value.toLocaleString('tr-TR')} ${unit}`;
        } else if (unit === '%') {
            valueElement.textContent = `${value}${unit}`;
        } else {
            valueElement.textContent = `${value.toLocaleString('tr-TR')} ${unit}`;
        }
    }
    
    if (changeElement) {
        const isPositive = change < 0; // For cost/emissions, negative is good
        changeElement.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
        
        const sign = change >= 0 ? '+' : '';
        
        if (percentage !== null) {
            if (unit === '%') {
                changeElement.textContent = `${sign}${change.toFixed(1)} puan`;
            } else {
                changeElement.textContent = `${sign}${change.toLocaleString('tr-TR')} ${unit} (${sign}${percentage}%)`;
            }
        } else {
            changeElement.textContent = `${sign}${change} puan`;
        }
    }
}

// ============== EXPORT & SAVE FUNCTIONS ==============
function exportReport() {
    alert('Rapor PDF olarak indiriliyor...\n(Bu özellik geliştirme aşamasındadır)');
    console.log('Export report functionality would generate PDF here');
}

// ============== FLEET ROUTE OPTIMIZATION ==============
let fleetMap = null;
let routeData = null;
let routeLayers = {};
let selectedVehicleId = null;


function displayRouteSummary(summary) {
    document.getElementById('routeSummary').style.display = 'block';
    document.getElementById('summaryVehicles').textContent = summary.total_vehicles;
    document.getElementById('summaryContainers').textContent = summary.assigned_containers;
    document.getElementById('summaryDistance').textContent = summary.total_distance_km + ' km';
    document.getElementById('summaryTime').textContent = summary.total_time_hours + ' saat';
}

function displayVehicleList(routes) {
    const vehicleList = document.getElementById('vehicleList');
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    
    vehicleList.innerHTML = routes.map((route, index) => {
        const color = colors[index % colors.length];
        return `
            <div class="vehicle-list-item" 
                 data-vehicle-id="${route.vehicle_id}"
                 onclick="selectVehicle(${route.vehicle_id})"
                 style="padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 6px; cursor: pointer; border-left: 4px solid ${color}; background: #f8f9fa; transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: ${color}; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 0.8rem; font-weight: bold;">${index + 1}</span>
                    <strong style="font-size: 0.9rem;">${route.plate_number}</strong>
                </div>
                <div style="font-size: 0.75rem; color: #666; margin-left: 32px;">
                    ${route.total_containers} konteyner • ${route.total_distance_km} km
                </div>
            </div>
        `;
    }).join('');
}

function initializeMap() {
    const mapContainer = document.getElementById('fleetMapContainer');
    mapContainer.style.display = 'block';
    
    // Harita zaten varsa temizle
    if (fleetMap) {
        fleetMap.remove();
    }
    
    // Yeni harita oluştur
    fleetMap = L.map('fleetMap').setView([40.19, 28.87], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(fleetMap);
    
    // Tüm rotalar için layer grupları oluştur
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    routeLayers = {};
    
    routeData.routes.forEach((route, index) => {
        const color = colors[index % colors.length];
        const layerGroup = L.layerGroup();
        
        if (route.route_points && route.route_points.length > 0) {
            // Gerçek yol geometrisini kullan (OSRM'den gelen)
            const routeLine = route.route_geometry && route.route_geometry.length > 0 
                ? route.route_geometry 
                : route.route_points;
            
            // Rota çizgisi (gerçek yollar)
            const polyline = L.polyline(routeLine, {
                color: color,
                weight: 4,
                opacity: 0.8
            });
            layerGroup.addLayer(polyline);
            
            // Konteyner marker'ları
            route.route_points.forEach((point, idx) => {
                const marker = L.circleMarker(point, {
                    radius: 7,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                });
                
                marker.bindPopup(`
                    <strong>${route.plate_number}</strong><br>
                    Konteyner #${idx + 1}<br>
                    Tip: ${route.container_details[idx].container_type}
                `);
                
                layerGroup.addLayer(marker);
            });
            
            // Başlangıç marker'ı
            const startMarker = L.marker(route.route_points[0], {
                icon: L.divIcon({
                    html: `<div style="background: ${color}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${index + 1}</div>`,
                    className: '',
                    iconSize: [30, 30]
                })
            });
            
            startMarker.bindPopup(`<strong>Başlangıç</strong><br>${route.plate_number}`);
            layerGroup.addLayer(startMarker);
        }
        
        routeLayers[route.vehicle_id] = layerGroup;
    });
    
    // Tüm rotaları haritaya ekle (başlangıçta hepsi görünür)
    Object.values(routeLayers).forEach(layer => layer.addTo(fleetMap));
    
    // Haritayı tüm rotaları gösterecek şekilde ayarla
    const allPoints = routeData.routes.flatMap(r => r.route_points);
    if (allPoints.length > 0) {
        fleetMap.fitBounds(allPoints);
    }
}

function selectVehicle(vehicleId) {
    selectedVehicleId = vehicleId;
    
    // Tüm list itemlerden active class'ını kaldır
    document.querySelectorAll('.vehicle-list-item').forEach(item => {
        if (parseInt(item.dataset.vehicleId) === vehicleId) {
            item.style.background = '#e3f2fd';
            item.style.fontWeight = 'bold';
        } else {
            item.style.background = '#f8f9fa';
            item.style.fontWeight = 'normal';
        }
    });
    
    // Haritadan tüm layer'ları kaldır
    Object.entries(routeLayers).forEach(([vId, layer]) => {
        fleetMap.removeLayer(layer);
    });
    
    // Sadece seçili aracın layer'ını ekle
    if (routeLayers[vehicleId]) {
        routeLayers[vehicleId].addTo(fleetMap);
        
        // Seçili aracın rotasına zoom yap
        const selectedRoute = routeData.routes.find(r => r.vehicle_id === vehicleId);
        if (selectedRoute && selectedRoute.route_points.length > 0) {
            fleetMap.fitBounds(selectedRoute.route_points);
        }
    }
    
    // Detayları göster
    displaySelectedVehicleDetails(vehicleId);
}

function displaySelectedVehicleDetails(vehicleId) {
    const selectedRoute = routeData.routes.find(r => r.vehicle_id === vehicleId);
    if (!selectedRoute) return;
    
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    const index = routeData.routes.findIndex(r => r.vehicle_id === vehicleId);
    const color = colors[index % colors.length];
    
    document.getElementById('routeDetails').style.display = 'block';
    document.getElementById('routeDetailContent').innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="color: ${color}; margin: 0;">
                    <span style="display: inline-block; width: 30px; height: 30px; background: ${color}; color: white; border-radius: 50%; text-align: center; line-height: 30px; margin-right: 10px;">${index + 1}</span>
                    ${selectedRoute.plate_number} - ${selectedRoute.vehicle_type}
                </h4>
                <span style="background: ${color}20; color: ${color}; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600;">
                    ${selectedRoute.capacity_usage}% Doluluk
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Konteyner Sayısı</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.total_containers}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Mesafe</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.total_distance_km} km</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Tahmini Süre</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.estimated_time_min} dk</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Toplam Ağırlık</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.total_weight_tons} ton</div>
                </div>
            </div>
        </div>
    `;
}

function displayRouteMap(routes) {
    // Bu fonksiyon artık kullanılmıyor ama uyumluluk için bırakıldı
    initializeMap();
}

function displayRouteDetails(routes) {
    // Bu fonksiyon artık kullanılmıyor - selectVehicle kullanılıyor
}

// ============== ROUTE OPTIMIZATION ==============

function displayVehicleAllocationRoutes(data) {
    const summaryDiv = document.getElementById('rotaSummary');
    const summaryContent = document.getElementById('rotaSummaryContent');
    const containerDiv = document.getElementById('rotasContainer');
    
    // Display summary statistics
    const summary = data.summary;
    summaryContent.innerHTML = `
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #4CAF50;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🚗 Toplam Araç</div>
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${summary.total_vehicles}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #2196F3;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📍 Mahalleler</div>
            <div style="font-size: 24px; font-weight: bold; color: #2196F3;">${summary.total_neighborhoods}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #FF9800;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">� Toplam Konteyner</div>
            <div style="font-size: 24px; font-weight: bold; color: #FF9800;">${summary.total_containers}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #F44336;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🔄 Tahmini Turlar</div>
            <div style="font-size: 24px; font-weight: bold; color: #F44336;">${summary.total_tours}</div>
        </div>
    `;
    
    summaryDiv.style.display = 'block';
    
    // Display routes
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    
    containerDiv.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
            <thead>
                <tr style="background: linear-gradient(135deg, #006BB3 0%, #004d7f 100%); color: white;">
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">#</th>
                    <th style="padding: 10px; text-align: left; border: 1px solid #004d7f;">🏘️ Mahalle</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">👥 Nüfus</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">📦 Konteyner</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">🔴 Dolu Kont.</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">📊 Doluluğu %</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">⬇️ Yer Altı</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f; background: #16a085;">🚗 Araç</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f; background: #3498db;">🔄 Tur</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #004d7f;">⭐ Öncelik</th>
                </tr>
            </thead>
            <tbody>
                ${data.allocation_routes.map((route, idx) => {
                    const priorityText = route.priority === 1 ? 'KRİTİK' : route.priority === 2 ? 'NORMAL' : 'DÜŞÜK';
                    const priorityColor = route.priority === 1 ? '#F44336' : route.priority === 2 ? '#FF9800' : '#8BC34A';
                    const vehicleColor = route.vehicle_type === 'Büyük Çöp Kamyonu' ? '#27ae60' : '#3498db';
                    
                    return `
                        <tr style="border-bottom: 1px solid #ddd; background: ${idx % 2 === 0 ? '#fafafa' : 'white'};">
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: ${colors[idx % colors.length]}">${idx + 1}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; font-weight: 500;">${route.neighborhood}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(route.population / 1000).toFixed(1)}K</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${route.containers_count}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #e74c3c;">~${route.full_containers}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${route.fill_percent}%</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${route.underground_count}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; background: ${vehicleColor}; color: white; border-radius: 3px;">
                                ${route.vehicles_allocated}
                            </td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; background: #ecf0f1;">
                                ${route.tours_needed}
                            </td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; background: ${priorityColor}20; color: ${priorityColor}; font-weight: bold;">
                                ${priorityText}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        
        <div style="margin-top: 20px; padding: 15px; background: #e8f8f5; border-left: 4px solid #27ae60; border-radius: 3px;">
            <h4 style="margin: 0 0 10px 0; color: #27ae60;">📌 Notlar:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px;">
                <li><strong>Dolu Kont.:</strong> Hesaplama = INT((Doluluğu % / 100) × Konteyner Sayısı)</li>
                <li><strong>Araç Tipi:</strong> Yer Altı > 5 ise <span style="background: #27ae60; color: white; padding: 2px 5px;">Büyük Çöp Kamyonu</span>, değilse <span style="background: #3498db; color: white; padding: 2px 5px;">Küçük Çöp Kamyonu</span></li>
                <li><strong>Tur:</strong> Hesaplama = Dolu Kapasite (L) ÷ 5500 (araç kapasitesi)</li>
                <li style="color: #16a085;"><strong>✓ TÜM VERİLER GERÇEKTİR:</strong> adres_bazli.csv (konteyner & doluluk) + mahalle_nufus.csv (nüfus)</li>
            </ul>
        </div>
    `;
}

function displayOptimizedRoutes(fullData, filteredRoutes) {
    const summaryDiv = document.getElementById('rotaSummary');
    const summaryContent = document.getElementById('rotaSummaryContent');
    const containerDiv = document.getElementById('rotasContainer');
    
    // Display summary statistics
    const summary = fullData.summary;
    summaryContent.innerHTML = `
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #4CAF50;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🚗 Toplam Araç</div>
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${summary.total_vehicles}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #2196F3;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">✓ Aktif Rotalar</div>
            <div style="font-size: 24px; font-weight: bold; color: #2196F3;">${summary.active_routes}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #FF9800;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📍 Mahalleler</div>
            <div style="font-size: 24px; font-weight: bold; color: #FF9800;">${summary.total_neighborhoods_assigned}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #F44336;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📦 Konteyner</div>
            <div style="font-size: 24px; font-weight: bold; color: #F44336;">${summary.total_containers}</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #9C27B0;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">⚖️ Ort. Yük</div>
            <div style="font-size: 24px; font-weight: bold; color: #9C27B0;">${summary.average_load_percent.toFixed(1)}%</div>
        </div>
        <div style="padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #00BCD4;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">⚡ Toplam Kapasite</div>
            <div style="font-size: 24px; font-weight: bold; color: #00BCD4;">${summary.total_capacity_tons.toFixed(1)} Ton</div>
        </div>
    `;
    
    summaryDiv.style.display = 'block';
    
    // Display routes
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    
    containerDiv.innerHTML = filteredRoutes.map((route, idx) => {
        const color = colors[idx % colors.length];
        const loadColor = route.load_percent > 85 ? '#F44336' : route.load_percent > 70 ? '#FF9800' : '#4CAF50';
        
        return `
            <div style="margin-bottom: 20px; background: white; border-radius: 8px; padding: 15px; border-left: 4px solid ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <h3 style="margin: 0; color: ${color};">
                            <span style="display: inline-block; width: 28px; height: 28px; background: ${color}; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px; margin-right: 8px;">${idx + 1}</span>
                            ${route.vehicle_name}
                        </h3>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">🚗 ${route.vehicle_type}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${loadColor}; color: white; padding: 8px 12px; border-radius: 4px; font-weight: bold;">
                            ${route.load_percent.toFixed(1)}% Doluluk
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 12px 0;">
                    <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">⚖️ Kapasite</div>
                        <div style="font-size: 16px; font-weight: bold; color: #333;">${route.capacity_ton} Ton</div>
                    </div>
                    <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">📊 Yük</div>
                        <div style="font-size: 16px; font-weight: bold; color: #333;">${route.assigned_load_ton.toFixed(2)} Ton</div>
                    </div>
                    <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">📍 Mahalle</div>
                        <div style="font-size: 16px; font-weight: bold; color: #333;">${route.neighborhoods_count}</div>
                    </div>
                    <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">📦 Konteyner</div>
                        <div style="font-size: 16px; font-weight: bold; color: #333;">${route.total_containers}</div>
                    </div>
                    <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">⏱️ Tahmini Saat</div>
                        <div style="font-size: 16px; font-weight: bold; color: #333;">${route.estimated_time_hours.toFixed(1)} sa</div>
                    </div>
                    <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">⭐ Öncelik Ort.</div>
                        <div style="font-size: 16px; font-weight: bold; color: #333;">${route.priority_average.toFixed(1)}</div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;">
                    <div style="font-size: 12px; font-weight: bold; color: #333; margin-bottom: 8px;">📍 Atanan Mahalleler:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${route.neighborhoods.map(n => `
                            <div style="background: ${color}20; border: 1px solid ${color}; color: ${color}; padding: 6px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                                ${n.name} (${n.containers} konteyner)
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (filteredRoutes.length === 0) {
        containerDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <p>⚠️ Seçili filtrelerle rota bulunamadı</p>
            </div>
        `;
    }
}

// ============== HARITA GÖRSELLENDIRMESI ==============
let neighborhoodMarkers = {};


async function loadNeighborhoodData() {
    try {
        const response = await fetch('/api/neighborhoods/map-data');
        const data = await response.json();
        
        if (!data.success) {
            Console.error('Mahalle verisi yükleme hatası');
            return;
        }
        
        displayNeighborhoodsOnMap(data.neighborhoods);
        updateNeighborhoodStatusList(data.neighborhoods);
        
    } catch (error) {
        console.error('Mahalle verisi yükleme hatası:', error);
    }
}

function displayNeighborhoodsOnMap(neighborhoods) {
    // Mevcut markerları temizle
    Object.values(neighborhoodMarkers).forEach(marker => {
        if (rotaMap) rotaMap.removeLayer(marker);
    });
    neighborhoodMarkers = {};
    
    // Her mahalleye marker ekle
    neighborhoods.forEach(n => {
        // %100 dolu ise ACIL
        const is_critical = n.fill_level >= 100;
        
        // Doluluk oranına göre markerın boyutunu belirle
        const fillRatio = Math.min(n.fill_level / 100, 1);  // 0-1 arasında
        const markerSize = is_critical ? 40 : (20 + (fillRatio * 15)); // Acil: 40px, Normal: 20-35px
        
        // Acil marker HTML'i farklı
        const markerHtml = is_critical ? `
            <div style="
                width: ${markerSize}px;
                height: ${markerSize}px;
                background: #ff0000;
                border: 3px solid #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                color: white;
                box-shadow: 0 0 15px rgba(255, 0, 0, 0.8), 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: all 0.2s;
                animation: pulse 1s infinite;
            ">
                ⚠️
            </div>
        ` : `
            <div style="
                width: ${markerSize}px;
                height: ${markerSize}px;
                background: ${n.color};
                border: 2px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: all 0.2s;
            ">
                ${Math.round(n.fill_level)}%
            </div>
        `;
        
        // Custom icon oluştur
        const customIcon = L.divIcon({
            html: markerHtml,
            iconSize: [markerSize, markerSize],
            className: is_critical ? 'neighborhood-marker-critical' : 'neighborhood-marker'
        });
        
        // Marker oluştur ve haritaya ekle
        const marker = L.marker([n.latitude, n.longitude], { icon: customIcon })
            .bindPopup(`
                <div style="font-size: 12px;">
                    <strong>${n.name}</strong><br/>
                    ${is_critical ? '<span style="color: red; font-weight: bold;">🔴 ACİL DOLU</span><br/>' : ''}
                    📊 Doluluk: ${n.fill_level}%<br/>
                    📦 Konteyner: ${n.container_count}<br/>
                    👥 Nüfus: ${n.population.toLocaleString('tr-TR')}<br/>
                    ⚖️ Ağırlık: ${n.total_weight_tons} Ton
                </div>
            `, {
                maxWidth: 200
            })
            .addTo(rotaMap);
        
        neighborhoodMarkers[n.id] = marker;
    });
    
    // Haritayı tüm markerları gösterecek şekilde ayarla
    if (Object.keys(neighborhoodMarkers).length > 0) {
        const group = new L.FeatureGroup(Object.values(neighborhoodMarkers));
        rotaMap.fitBounds(group.getBounds().pad(0.1));
    }
}

function updateNeighborhoodStatusList(neighborhoods) {
    const listDiv = document.getElementById('neighborhoodStatusList');
    
    // Doluluk oranına göre sırala
    const sorted = [...neighborhoods].sort((a, b) => b.fill_level - a.fill_level);
    
    listDiv.innerHTML = sorted.slice(0, 10).map(n => {
        const status = n.fill_level > 75 ? '🔴' : n.fill_level > 50 ? '🟠' : '🟢';
        return `
            <div style="padding: 8px; border-bottom: 1px solid #ddd; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: bold; color: #333;">
                        ${status} ${n.name}
                    </div>
                    <div style="color: #666; font-weight: bold;">
                        ${n.fill_level}%
                    </div>
                </div>
                <div style="font-size: 11px; color: #999; margin-top: 4px;">
                    ${n.container_count} konteyner • ${n.total_weight_tons} Ton
                </div>
            </div>
        `;
    }).join('');
}

// Tab seçildiğinde haritayı başlat

function displayOptimizationRoutesOnMap(routes) {
    if (!rotaMap) return;
    
    // Renk paleti - her araç için farklı renk
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', 
                    '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    
    // Mevcut polyline'ları temizle
    if (window.routePolylines) {
        window.routePolylines.forEach(line => rotaMap.removeLayer(line));
    }
    window.routePolylines = [];
    
    // Her rota için polyline çiz
    routes.forEach((route, idx) => {
        const color = colors[idx % colors.length];
        const coordinates = [];
        
        // Rotanın mahallelerinin koordinatlarını topla
        route.neighborhoods.forEach(n => {
            if (neighborhoodMarkers[n.id]) {
                const latlng = neighborhoodMarkers[n.id].getLatLng();
                coordinates.push([latlng.lat, latlng.lng]);
            }
        });
        
        // Eğer koordinatlar varsa polyline çiz
        if (coordinates.length > 0) {
            const polyline = L.polyline(coordinates, {
                color: color,
                weight: 2.5,
                opacity: 0.7,
                dashArray: '5, 5',
                className: `route-${route.route_id}`
            }).bindPopup(`
                <div style="font-size: 12px;">
                    <strong>${route.vehicle_name}</strong><br/>
                    🚗 ${route.vehicle_type}<br/>
                    📍 Mahalleler: ${route.neighborhoods_count}<br/>
                    📦 Konteyner: ${route.total_containers}<br/>
                    ⚖️ Yük: ${route.load_percent.toFixed(1)}%<br/>
                    ⏱️ Saat: ${route.estimated_time_hours.toFixed(1)}sa
                </div>
            `).addTo(rotaMap);
            
            window.routePolylines.push(polyline);
        }
        
        // Rota başlangıç noktasına marker ekle
        if (coordinates.length > 0) {
            const startMarker = L.circleMarker(coordinates[0], {
                radius: 8,
                fillColor: color,
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).bindPopup(`<strong>🚩 ${route.vehicle_name} Başlangıç</strong>`)
            .addTo(rotaMap);
            
            window.routePolylines.push(startMarker);
        }
    });
    
    console.log(`✓ ${routes.length} rota haritada gösterildi`);
}

// ============== USERS MANAGEMENT ==============
async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        
        const usersList = document.getElementById('usersList');
        const isDarkMode = document.body.classList.contains('admin-dark-mode');
        const textColor = isDarkMode ? '#FFFFFF' : '#333333';
        const tableHeaderBg = isDarkMode ? '#003d66' : '#0066B3';
        const tableRowBg1 = isDarkMode ? '#2d2d2d' : '#f0f7ff';
        const tableRowBg2 = isDarkMode ? '#1a1a1a' : 'white';
        const borderColor = isDarkMode ? '#444444' : '#ddd';
        
        if (!data.users || data.users.length === 0) {
            usersList.innerHTML = `<div style="text-align: center; padding: 40px; color: ${textColor};">
                <p>Henüz kayıtlı kullanıcı bulunmuyor</p>
            </div>`;
            return;
        }
        
        usersList.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: ${tableHeaderBg}; color: white;">
                        <th style="padding: 12px; text-align: left; border: 1px solid ${borderColor};">TC Numarası</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid ${borderColor};">Adı</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid ${borderColor};">Email</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid ${borderColor};">Güven Puanı</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid ${borderColor};">Toplam Raporlar</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid ${borderColor};">Doğru Raporlar</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid ${borderColor};">Doğruluk %</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.users.map((user, idx) => {
                        const accuracy = user.total_reports > 0 
                            ? ((user.accurate_reports / user.total_reports) * 100).toFixed(1)
                            : 0;
                        const trustColor = user.trust_score >= 0.8 ? '#00A651' : user.trust_score >= 0.5 ? '#FFA500' : '#E74C3C';
                        const rowBg = idx % 2 === 0 ? tableRowBg1 : tableRowBg2;
                        
                        return `
                            <tr style="border-bottom: 1px solid ${borderColor}; background-color: ${rowBg}; color: ${textColor};">
                                <td style="padding: 12px; border: 1px solid ${borderColor}; font-weight: 600; color: ${textColor};">${user.tc_number}</td>
                                <td style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">${user.name}</td>
                                <td style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">${user.email}</td>
                                <td style="padding: 12px; border: 1px solid ${borderColor}; text-align: center; color: ${trustColor}; font-weight: 600;">
                                    ${user.trust_score.toFixed(2)}
                                </td>
                                <td style="padding: 12px; border: 1px solid ${borderColor}; text-align: center; color: ${textColor};">${user.total_reports}</td>
                                <td style="padding: 12px; border: 1px solid ${borderColor}; text-align: center; color: ${textColor};">${user.accurate_reports}</td>
                                <td style="padding: 12px; border: 1px solid ${borderColor}; text-align: center; font-weight: 600; color: ${textColor};">${accuracy}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        console.error('Users load error:', e);
        const isDarkMode = document.body.classList.contains('admin-dark-mode');
        const errorColor = isDarkMode ? '#ff6b6b' : '#E74C3C';
        document.getElementById('usersList').innerHTML = `<div style="color: ${errorColor}; padding: 20px;">Hata: ${e.message}</div>`;
    }
}

// ============== INITIALIZATION ==============
console.log('Admin dashboard loaded successfully');
