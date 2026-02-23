// Complete settings.js with WiFi fixes and all existing functionality

// Reboot or shutdown the system
async function controlSystem(action) {
    const ok = await window.appConfirm(`Are you sure you want to ${action} the system?`);
    if (ok) {
        fetch(`/${action}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => window.appAlert(data.status))
            .catch(err => console.error(`Error performing ${action}:`, err));
    }
}

// Scrolling variables from your script.js
let modalDragScroll = {
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollStartLeft: 0,
    scrollStartTop: 0
};

// Check for updates using git pull
function checkForUpdates() {
    const updateModal = document.getElementById('update-modal');
    const updateLogs = document.getElementById('update-logs');
    updateLogs.innerHTML = "Starting git pull...\n"; 
    
    // Show the modal using Bootstrap
    const bsUpdateModal = new bootstrap.Modal(updateModal);
    bsUpdateModal.show();
    
    fetch('/git-pull')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateLogs.innerHTML += "Git pull successful.\n";
                updateLogs.innerHTML += data.output + "\n";
                updateLogs.innerHTML += "Rebooting system in 5 seconds...\n";
                
                // Auto scroll to bottom
                updateLogs.scrollTop = updateLogs.scrollHeight;
                
                // Reboot after 5 seconds
                setTimeout(() => {
                    controlSystem('reboot');
                }, 5000);
            } else {
                updateLogs.innerHTML += "Git pull failed:\n";
                updateLogs.innerHTML += data.error + "\n";
            }
            
            // Auto scroll to bottom
            updateLogs.scrollTop = updateLogs.scrollHeight;
        })
        .catch(err => {
            console.error('Error during git pull:', err);
            updateLogs.innerHTML += `Error during git pull: ${err.message}\n`;
            updateLogs.scrollTop = updateLogs.scrollHeight;
        });
}

// Perform system update with terminal-like logs
function performSystemUpdate() {
    const updateModal = document.getElementById('update-modal');
    const updateLogs = document.getElementById('update-logs');
    updateLogs.innerHTML = "Starting system update...\n"; 
    
    // Show the modal using Bootstrap
    const bsUpdateModal = new bootstrap.Modal(updateModal);
    bsUpdateModal.show();
    
    // Create EventSource for streaming update logs
    const eventSource = new EventSource('/system-update-logs');
    
    eventSource.onmessage = (event) => {
        // Append the new log line
        updateLogs.innerHTML += event.data + "\n";
        // Auto-scroll to the latest log
        updateLogs.scrollTop = updateLogs.scrollHeight;
    };
    
    eventSource.onerror = () => {
        // Close the connection when it errors out (which might be normal at the end)
        eventSource.close();
        
        // Add a final message if it's not already there
        if (!updateLogs.innerHTML.includes("System update completed") && 
            !updateLogs.innerHTML.includes("Update failed")) {
            updateLogs.innerHTML += "Connection closed. The system may be rebooting.\n";
        }
        
        updateLogs.scrollTop = updateLogs.scrollHeight;
    };
}

// Close the update modal
function closeUpdateModal() {
    const updateModal = document.getElementById('update-modal');
    const bsUpdateModal = bootstrap.Modal.getInstance(updateModal);
    if (bsUpdateModal) {
        bsUpdateModal.hide();
    }
}

// System name setting
function loadSystemName() {
    const input = document.getElementById('systemNameInput');
    if (!input) return;
    fetch('/api/system-name')
        .then(res => res.json())
        .then(data => {
            if (data.system_name) {
                input.value = data.system_name;
            }
        })
        .catch(() => {});
}

function saveSystemName() {
    const input = document.getElementById('systemNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        window.appAlert('Please enter a system name');
        return;
    }
    fetch('/api/system-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_name: name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.appAlert(`System name updated to "${data.system_name}"`);
            // Update header label immediately if present
            const headerKicker = document.querySelector('.header-kicker');
            if (headerKicker) headerKicker.textContent = data.system_name;
        } else {
            window.appAlert(data.error || 'Failed to update system name');
        }
    })
    .catch(() => window.appAlert('Failed to update system name'));
}

function loadScreensaver() {
    const toggleBtn = document.getElementById('screensaverToggleBtn');
    const timeoutInput = document.getElementById('screensaverTimeout');
    const photoSelect = document.getElementById('screensaverPhoto');
    const photoBtn = document.getElementById('screensaverPhotoBtn');
    const previewWrap = document.getElementById('screensaverPreviewWrap');
    const previewImg = document.getElementById('screensaverPreview');
    if (!toggleBtn || !timeoutInput || !photoSelect || !photoBtn || !previewWrap || !previewImg) return;

    fetch('/api/photo-library/list-saved')
        .then(res => res.json())
        .then(data => {
            if (!data.success) return;
            const grid = document.getElementById('screensaverPhotoGrid');
            if (grid) {
                grid.innerHTML = '';
                data.photos.forEach(photo => {
                    const card = document.createElement('button');
                    card.type = 'button';
                    card.className = 'btn btn-outline w-100';
                    card.style.textAlign = 'left';
                    card.innerHTML = `
                        <img src="${photo.url}" alt="${photo.name}" style="width:100%; height:120px; object-fit:cover; border-radius:10px; margin-bottom:8px;">
                        <div>${photo.folder}/${photo.name}</div>
                    `;
                    card.addEventListener('click', () => {
                        setScreensaverPhoto(photo.url);
                        const modal = bootstrap.Modal.getInstance(document.getElementById('screensaverPhotoModal'));
                        if (modal) modal.hide();
                    });
                    grid.appendChild(card);
                });
            }
        })
        .catch(() => {});

    fetch('/api/screensaver')
        .then(res => res.json())
        .then(data => {
            toggleBtn.textContent = data.enabled ? 'Enabled' : 'Disabled';
            toggleBtn.className = data.enabled ? 'btn btn-success w-100' : 'btn btn-outline w-100';
            timeoutInput.value = data.timeout || 120;
            setScreensaverPhoto(data.photo || '');
        })
        .catch(() => {});
}

function toggleScreensaver() {
    const toggleBtn = document.getElementById('screensaverToggleBtn');
    if (!toggleBtn) return;
    const enabled = !toggleBtn.classList.contains('btn-success');
    toggleBtn.textContent = enabled ? 'Enabled' : 'Disabled';
    toggleBtn.className = enabled ? 'btn btn-success w-100' : 'btn btn-outline w-100';
}

function setScreensaverPhoto(url) {
    const photoSelect = document.getElementById('screensaverPhoto');
    const previewWrap = document.getElementById('screensaverPreviewWrap');
    const previewImg = document.getElementById('screensaverPreview');
    if (!photoSelect || !previewWrap || !previewImg) return;
    photoSelect.value = url || '';
    if (!url) {
        previewWrap.style.display = 'none';
        previewImg.src = '';
        return;
    }
    previewImg.src = url;
    previewWrap.style.display = 'block';
}

function saveScreensaver() {
    const toggleBtn = document.getElementById('screensaverToggleBtn');
    const timeoutInput = document.getElementById('screensaverTimeout');
    const photoSelect = document.getElementById('screensaverPhoto');
    if (!toggleBtn || !timeoutInput || !photoSelect) return;
    const enabled = toggleBtn.classList.contains('btn-success');
    const timeout = parseInt(timeoutInput.value || '120', 10);
    const photo = photoSelect.value || '';
    fetch('/api/screensaver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, timeout, photo })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.appAlert('Screensaver settings saved');
            if (window.updateScreensaverConfig) {
                window.updateScreensaverConfig({ enabled, timeout, photo });
            }
        } else {
            window.appAlert('Failed to save screensaver settings');
        }
    })
    .catch(() => window.appAlert('Failed to save screensaver settings'));
}

function openVersionHistory() {
    const modalEl = document.getElementById('version-modal');
    const pre = document.getElementById('version-history');
    if (!modalEl || !pre) return;
    pre.textContent = 'Loading version history...';
    fetch('/api/version-history')
        .then(res => res.json())
        .then(data => {
            pre.textContent = data.history || 'No version history available.';
        })
        .catch(() => {
            pre.textContent = 'Failed to load version history.';
        });
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}
// UPDATED WiFi Functions - Enhanced with NetworkManager support

// Open WiFi Config Modal with NetworkManager status check
function openWiFiConfig() {
    const modal = document.getElementById('wifi-modal');
    const bsModal = new bootstrap.Modal(modal);
    
    // Check NetworkManager status first
    checkNetworkManagerStatus();
    
    bsModal.show();
    
    // Set up scrolling for modal body
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        setupModalBodyScroll(modalBody);
    }, 100);
}

// Close WiFi modal
function closeWiFiModal() {
    const modal = document.getElementById('wifi-modal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
        bsModal.hide();
    }
}

// Check NetworkManager status and availability
function checkNetworkManagerStatus() {
    const statusElement = document.getElementById('wifi-status');
    
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="alert alert-info mb-0">
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    <span>Checking NetworkManager status...</span>
                </div>
            </div>
        `;
    }
    
    fetch('/wifi-status')
        .then(response => response.json())
        .then(data => {
            if (data.error && (data.error.includes("NetworkManager") || data.error.includes("Cannot check"))) {
                if (statusElement) {
                    statusElement.innerHTML = `
                        <div class="alert alert-warning mb-3">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <i class="bi bi-exclamation-triangle me-2"></i>
                                    <strong>NetworkManager not configured</strong>
                                    <div class="small">WiFi functionality requires NetworkManager</div>
                                </div>
                                <button class="btn btn-sm btn-outline-warning" onclick="enableNetworkManager()">
                                    Enable
                                </button>
                            </div>
                        </div>
                    `;
                }
            } else {
                updateWiFiStatus();
                // Auto-scan for networks if NetworkManager is working
                setTimeout(() => scanForNetworks(), 500);
            }
        })
        .catch(err => {
            console.error('Error checking NetworkManager status:', err);
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Error checking network status</strong>
                        <div class="small">Please check system configuration</div>
                    </div>
                `;
            }
        });
}

// Enable NetworkManager if not properly configured
function enableNetworkManager() {
    const statusElement = document.getElementById('wifi-status');
    
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="alert alert-info mb-0">
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    <span>Enabling NetworkManager...</span>
                </div>
            </div>
        `;
    }
    
    fetch('/enable-networkmanager', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (statusElement) {
                    statusElement.innerHTML = `
                        <div class="alert alert-success mb-3">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <i class="bi bi-check-circle me-2"></i>
                                    <strong>NetworkManager enabled</strong>
                                    <div class="small">${data.message}</div>
                                </div>
                                <button class="btn btn-sm btn-outline-success" onclick="controlSystem('reboot')">
                                    Reboot Now
                                </button>
                            </div>
                        </div>
                    `;
                }
            } else {
                if (statusElement) {
                    statusElement.innerHTML = `
                        <div class="alert alert-danger mb-0">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            <strong>Failed to enable NetworkManager</strong>
                            <div class="small">${data.error}</div>
                        </div>
                    `;
                }
            }
        })
        .catch(err => {
            console.error('Error enabling NetworkManager:', err);
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Error enabling NetworkManager</strong>
                        <div class="small">Please try manual configuration</div>
                    </div>
                `;
            }
        });
}

// Enhanced WiFi network scanning with better error handling
function scanForNetworks() {
    const networksContainer = document.getElementById('networks-container');
    const scanBtn = document.getElementById('scan-networks-btn');
    
    if (networksContainer) {
        networksContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <p class="mb-2">Scanning for networks...</p>
                <small class="text-muted">This may take a few seconds</small>
            </div>
        `;
    }
    
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Scanning...';
    }
    
    fetch('/scan-wifi-networks')
        .then(response => response.json())
        .then(data => {
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Scan Again';
            }
            
            if (data.success && networksContainer) {
                if (data.networks.length === 0) {
                    networksContainer.innerHTML = `
                        <div class="alert alert-warning">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-wifi-off me-2 fs-4"></i>
                                <div>
                                    <strong>No networks found</strong>
                                    <div class="small">Make sure WiFi is enabled and try scanning again</div>
                                </div>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                let html = '<div class="list-group">';
                
                data.networks.forEach(network => {
                    const signalStrength = getSignalStrengthIcon(network.signal);
                    const securityIcon = network.security ? 
                        '<i class="bi bi-lock-fill ms-2 text-warning"></i>' : 
                        '<i class="bi bi-unlock ms-2 text-success"></i>';
                    
                    html += `
                        <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center bg-dark text-white border-secondary hover-highlight" 
                                onclick="connectToNetwork('${escapeHtml(network.ssid)}', ${network.security})"
                                style="border-radius: 8px; margin-bottom: 4px; transition: all 0.2s ease;">
                            <div class="d-flex align-items-center">
                                <span class="me-2 fw-medium">${escapeHtml(network.ssid)}</span>
                                ${securityIcon}
                            </div>
                            <div class="d-flex align-items-center">
                                <small class="text-muted me-2">${network.signal}%</small>
                                ${signalStrength}
                            </div>
                        </button>
                    `;
                });
                
                html += '</div>';
                networksContainer.innerHTML = html;
            } else {
                const errorMsg = data.error || 'Failed to scan networks';
                let actionButton = '';
                
                if (errorMsg.includes('NetworkManager')) {
                    actionButton = '<button class="btn btn-sm btn-outline-warning mt-2" onclick="enableNetworkManager()">Enable NetworkManager</button>';
                } else {
                    actionButton = '<button class="btn btn-sm btn-outline-light mt-2" onclick="scanForNetworks()">Try Again</button>';
                }
                
                networksContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi bi-exclamation-triangle me-2 fs-4"></i>
                            <div>
                                <strong>Scan Failed</strong>
                                <div class="small">${errorMsg}</div>
                            </div>
                        </div>
                        ${actionButton}
                    </div>
                `;
            }
            
            // Fix scrolling after updating content
            const modalBody = document.querySelector('#wifi-modal .modal-body');
            if (modalBody) {
                setupModalBodyScroll(modalBody);
            }
        })
        .catch(err => {
            console.error('Error scanning networks:', err);
            if (networksContainer) {
                networksContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi bi-exclamation-triangle me-2 fs-4"></i>
                            <div>
                                <strong>Network Scan Error</strong>
                                <div class="small">An error occurred while scanning</div>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-light mt-2" onclick="scanForNetworks()">Try Again</button>
                    </div>
                `;
            }
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Scan Again';
            }
        });
}

// Enhanced signal strength icon with percentage-based logic
function getSignalStrengthIcon(signal) {
    // Handle both dBm (-30 to -90) and percentage (0-100) formats
    let percentage;
    if (signal < 0) {
        // Convert dBm to percentage (rough approximation)
        percentage = Math.max(0, Math.min(100, 2 * (signal + 100)));
    } else {
        percentage = signal;
    }
    
    if (percentage >= 75) {
        return '<i class="bi bi-wifi text-success fs-5"></i>';
    } else if (percentage >= 50) {
        return '<i class="bi bi-wifi text-primary fs-5"></i>';
    } else if (percentage >= 25) {
        return '<i class="bi bi-wifi text-warning fs-5"></i>';
    } else {
        return '<i class="bi bi-wifi text-danger fs-5"></i>';
    }
}

// HTML escaping function to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enhanced network connection with better UI
function connectToNetwork(ssid, requiresPassword) {
    const networksContainer = document.getElementById('networks-container');
    
    if (requiresPassword) {
        // Show enhanced password input form
        if (networksContainer) {
            networksContainer.innerHTML = `
                <div class="card bg-dark border-secondary" style="border-radius: 12px;">
                    <div class="card-header d-flex justify-content-between align-items-center" style="background: rgba(255, 255, 255, 0.05); border-radius: 12px 12px 0 0;">
                        <div>
                            <strong>Connect to "${escapeHtml(ssid)}"</strong>
                            <div class="small text-muted">
                                <i class="bi bi-lock-fill me-1"></i>Secured Network
                            </div>
                        </div>
                        <i class="bi bi-wifi text-primary fs-4"></i>
                    </div>
                    <div class="card-body">
                        <form id="wifi-password-form" onsubmit="event.preventDefault(); submitWiFiConnection('${escapeHtml(ssid)}');">
                            <div class="mb-3">
                                <label for="wifi-password" class="form-label">Network Password</label>
                                <div class="input-group">
                                    <input type="password" class="form-control osk-input" id="wifi-password" required 
                                           placeholder="Enter network password" autocomplete="new-password">
                                    <button class="btn btn-outline-secondary" type="button" onclick="togglePasswordVisibility()" title="Show/Hide Password">
                                        <i class="bi bi-eye" id="password-toggle-icon"></i>
                                    </button>
                                </div>
                                <div class="form-text text-muted">
                                    <small><i class="bi bi-info-circle me-1"></i>Password will be saved for automatic reconnection</small>
                                </div>
                            </div>
                            <div class="d-flex justify-content-between gap-2">
                                <button type="button" class="btn btn-secondary flex-fill" onclick="scanForNetworks()">
                                    <i class="bi bi-arrow-left me-1"></i>Back
                                </button>
                                <button type="submit" class="btn btn-primary flex-fill">
                                    <i class="bi bi-wifi me-1"></i>Connect
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            // Focus on password input after a brief delay
            setTimeout(() => {
                const passwordInput = document.getElementById('wifi-password');
                if (passwordInput) {
                    passwordInput.focus();
                }
            }, 200);
        }
    } else {
        // Connect directly to open network
        connectWithPassword(ssid, '');
    }
    
    // Fix scrolling after updating content
    const modalBody = document.querySelector('#wifi-modal .modal-body');
    if (modalBody) {
        setupModalBodyScroll(modalBody);
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('wifi-password');
    const toggleIcon = document.getElementById('password-toggle-icon');
    
    if (passwordInput && toggleIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.className = 'bi bi-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleIcon.className = 'bi bi-eye';
        }
    }
}

// Submit WiFi connection with password validation
function submitWiFiConnection(ssid) {
    const passwordInput = document.getElementById('wifi-password');
    const password = passwordInput ? passwordInput.value : '';
    
    if (!password.trim()) {
        // Highlight the input field
        if (passwordInput) {
            passwordInput.classList.add('is-invalid');
            passwordInput.focus();
            setTimeout(() => {
                passwordInput.classList.remove('is-invalid');
            }, 3000);
        }
        return;
    }
    
    connectWithPassword(ssid, password);
}

// Enhanced connection process with detailed feedback
function connectWithPassword(ssid, password) {
    const networksContainer = document.getElementById('networks-container');
    
    if (networksContainer) {
        networksContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="mb-3">
                    <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                    <h6 class="mb-2">Connecting to "${escapeHtml(ssid)}"</h6>
                    <p class="text-muted mb-0">Please wait while we establish the connection...</p>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 100%"></div>
                </div>
            </div>
        `;
    }
    
    fetch('/connect-wifi', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ssid: ssid,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && networksContainer) {
            networksContainer.innerHTML = `
                <div class="alert alert-success" style="border-radius: 12px;">
                    <div class="d-flex align-items-center mb-3">
                        <i class="bi bi-check-circle-fill me-3 text-success" style="font-size: 2rem;"></i>
                        <div>
                            <h6 class="mb-1">Successfully Connected!</h6>
                            <small class="text-muted">${data.message || 'Connection established'}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-success" onclick="updateWiFiStatus()">
                            <i class="bi bi-arrow-repeat me-1"></i>Check Status
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="scanForNetworks()">
                            <i class="bi bi-wifi me-1"></i>Scan Networks
                        </button>
                    </div>
                </div>
            `;
            
            // Update the status at the top after a brief delay
            setTimeout(updateWiFiStatus, 2000);
            
        } else if (networksContainer) {
            const errorMsg = data.error || 'Failed to connect to network';
            networksContainer.innerHTML = `
                <div class="alert alert-danger" style="border-radius: 12px;">
                    <div class="d-flex align-items-center mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-3 text-danger" style="font-size: 2rem;"></i>
                        <div>
                            <h6 class="mb-1">Connection Failed</h6>
                            <small class="text-muted">${errorMsg}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-light" onclick="connectToNetwork('${escapeHtml(ssid)}', ${password ? 'true' : 'false'})">
                            <i class="bi bi-arrow-repeat me-1"></i>Try Again
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="scanForNetworks()">
                            <i class="bi bi-list me-1"></i>Back to Networks
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Fix scrolling after updating content
        const modalBody = document.querySelector('#wifi-modal .modal-body');
        if (modalBody) {
            setupModalBodyScroll(modalBody);
        }
    })
    .catch(err => {
        console.error('Error connecting to network:', err);
        if (networksContainer) {
            networksContainer.innerHTML = `
                <div class="alert alert-danger" style="border-radius: 12px;">
                    <div class="d-flex align-items-center mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-3 text-danger" style="font-size: 2rem;"></i>
                        <div>
                            <h6 class="mb-1">Connection Error</h6>
                            <small class="text-muted">An error occurred while trying to connect</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-light" onclick="connectToNetwork('${escapeHtml(ssid)}', ${password ? 'true' : 'false'})">
                            <i class="bi bi-arrow-repeat me-1"></i>Try Again
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="scanForNetworks()">
                            <i class="bi bi-list me-1"></i>Back to Networks
                        </button>
                    </div>
                </div>
            `;
        }
    });
}

// Enhanced WiFi status display
function updateWiFiStatus() {
    const statusElement = document.getElementById('wifi-status');
    
    fetch('/wifi-status')
        .then(response => response.json())
        .then(data => {
            if (statusElement) {
                if (data.connected) {
                    statusElement.innerHTML = `
                        <div class="alert alert-success mb-0" style="border-radius: 12px;">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-wifi me-3 text-success" style="font-size: 1.5rem;"></i>
                                    <div>
                                        <strong>Connected to "${data.ssid}"</strong>
                                        <div class="small text-muted">IP Address: ${data.ip}</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-success" onclick="updateWiFiStatus()" title="Refresh Status">
                                    <i class="bi bi-arrow-repeat"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    statusElement.innerHTML = `
                        <div class="alert alert-warning mb-0" style="border-radius: 12px;">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-wifi-off me-3 text-warning" style="font-size: 1.5rem;"></i>
                                    <div>
                                        <strong>Not connected to WiFi</strong>
                                        <div class="small text-muted">Scan for networks to connect</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-warning" onclick="scanForNetworks()" title="Scan Networks">
                                    <i class="bi bi-search"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            }
        })
        .catch(err => {
            console.error('Error checking WiFi status:', err);
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="alert alert-secondary mb-0" style="border-radius: 12px;">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-question-circle me-2"></i>
                            <span>Unable to check WiFi status</span>
                        </div>
                    </div>
                `;
            }
        });
}

// Set up scrolling for a specific modal body
function setupModalBodyScroll(modalBody) {
    if (!modalBody) return;
    
    // Reset any previous event listeners
    modalBody.removeEventListener('mousedown', handleScrollMouseDown);
    modalBody.removeEventListener('mousemove', handleScrollMouseMove);
    modalBody.removeEventListener('mouseup', handleScrollMouseUp);
    modalBody.removeEventListener('mouseleave', handleScrollMouseLeave);
    modalBody.removeEventListener('touchstart', handleScrollTouchStart);
    modalBody.removeEventListener('touchmove', handleScrollTouchMove);
    modalBody.removeEventListener('touchend', handleScrollTouchEnd);
    
    // Ensure modal body has proper styling for scrolling
    modalBody.style.overflow = 'auto';
    modalBody.style.overflowX = 'hidden';
    modalBody.style.maxHeight = '70vh';
    modalBody.style.position = 'relative';
    modalBody.style.userSelect = 'none';
    modalBody.style.webkitUserSelect = 'none';
    modalBody.style.touchAction = 'pan-y';
    modalBody.style.webkitOverflowScrolling = 'touch';
    
    // Add event listeners for mouse/touch scrolling
    modalBody.addEventListener('mousedown', handleScrollMouseDown);
    modalBody.addEventListener('mousemove', handleScrollMouseMove);
    modalBody.addEventListener('mouseup', handleScrollMouseUp);
    modalBody.addEventListener('mouseleave', handleScrollMouseLeave);
    
    // Touch events
    modalBody.addEventListener('touchstart', handleScrollTouchStart);
    modalBody.addEventListener('touchmove', handleScrollTouchMove, { passive: false });
    modalBody.addEventListener('touchend', handleScrollTouchEnd);
}

// Mouse event handlers for scrolling
function handleScrollMouseDown(e) {
    // Only enable drag on primary mouse button
    if (e.button !== 0) return;
    
    modalDragScroll.isDragging = true;
    this.classList.add('active-drag');
    modalDragScroll.startX = e.clientX;
    modalDragScroll.startY = e.clientY;
    modalDragScroll.scrollStartLeft = this.scrollLeft;
    modalDragScroll.scrollStartTop = this.scrollTop;
}

function handleScrollMouseMove(e) {
    if (!modalDragScroll.isDragging) return;
    
    e.preventDefault();
    const dx = e.clientX - modalDragScroll.startX;
    const dy = e.clientY - modalDragScroll.startY;
    this.scrollLeft = modalDragScroll.scrollStartLeft - dx;
    this.scrollTop = modalDragScroll.scrollStartTop - dy;
}

function handleScrollMouseUp() {
    modalDragScroll.isDragging = false;
    this.classList.remove('active-drag');
}

function handleScrollMouseLeave() {
    if (modalDragScroll.isDragging) {
        modalDragScroll.isDragging = false;
        this.classList.remove('active-drag');
    }
}

// Touch event handlers for scrolling
function handleScrollTouchStart(e) {
    const touch = e.touches[0];
    modalDragScroll.isDragging = true;
    modalDragScroll.startX = touch.clientX;
    modalDragScroll.startY = touch.clientY;
    modalDragScroll.scrollStartLeft = this.scrollLeft;
    modalDragScroll.scrollStartTop = this.scrollTop;
}

function handleScrollTouchMove(e) {
    if (!modalDragScroll.isDragging) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - modalDragScroll.startX;
    const dy = touch.clientY - modalDragScroll.startY;
    
    // Calculate movement direction
    const isScrollingVertically = Math.abs(dy) > Math.abs(dx);
    
    // If scrolling vertically and we're at the top or bottom edge, don't prevent default
    const isAtTop = this.scrollTop <= 0 && dy > 0;
    const isAtBottom = this.scrollTop >= (this.scrollHeight - this.offsetHeight) && dy < 0;
    
    if (isScrollingVertically && !isAtTop && !isAtBottom) {
        e.preventDefault();
    }
    
    this.scrollTop = modalDragScroll.scrollStartTop - dy;
}

function handleScrollTouchEnd() {
    modalDragScroll.isDragging = false;
}

// Load WiFi configuration from USB
async function loadWiFiConfigFromUSB() {
    const button = event.target;
    const originalText = button.innerHTML;
    
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Loading...';
    
    fetch('/load-usb-wifi-config', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            window.appAlert(data.message);
            if (data.message.includes('Successfully')) {
                // Refresh status if successful
                setTimeout(() => updateWiFiStatus(), 2000);
            }
        })
        .catch(err => {
            console.error('Error loading WiFi config from USB:', err);
            window.appAlert('Error loading WiFi configuration from USB');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        });
}

// Reset all network settings with confirmation
async function resetNetworkSettings() {
    const ok = await window.appConfirm('Are you sure you want to reset all network settings?\n\nThis will:\n• Remove all saved WiFi networks\n• Reset network configurations\n• Require reconfiguration after reboot');
    if (!ok) return;
    
    const button = event.target;
    const originalText = button.innerHTML;
    
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Resetting...';
    
    fetch('/reset-network-settings', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            window.appAlert(data.message);
            if (data.message.includes('reset')) {
                // Suggest reboot after reset
                window.appConfirm('Network settings have been reset.\n\nWould you like to reboot now to apply changes?')
                    .then(rebootOk => { if (rebootOk) controlSystem('reboot'); });
            }
        })
        .catch(err => {
            console.error('Error resetting network settings:', err);
            window.appAlert('Error resetting network settings');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        });
}

// Enhanced initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadSystemName();
    const saveBtn = document.getElementById('saveSystemNameBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSystemName);
    }
    loadScreensaver();
    const toggleBtn = document.getElementById('screensaverToggleBtn');
    const saveScreensaverBtn = document.getElementById('saveScreensaverBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleScreensaver);
    if (saveScreensaverBtn) saveScreensaverBtn.addEventListener('click', saveScreensaver);
    const screensaverPhotoBtn = document.getElementById('screensaverPhotoBtn');
    const clearScreensaverPhotoBtn = document.getElementById('clearScreensaverPhotoBtn');
    if (screensaverPhotoBtn) {
        screensaverPhotoBtn.addEventListener('click', () => {
            const modalEl = document.getElementById('screensaverPhotoModal');
            if (!modalEl) return;
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.show();
        });
    }
    if (clearScreensaverPhotoBtn) {
        clearScreensaverPhotoBtn.addEventListener('click', () => {
            setScreensaverPhoto('');
            const modal = bootstrap.Modal.getInstance(document.getElementById('screensaverPhotoModal'));
            if (modal) modal.hide();
        });
    }
    const versionBtn = document.getElementById('versionHistoryBtn');
    if (versionBtn) versionBtn.addEventListener('click', openVersionHistory);
    // Initialize all modals
    document.querySelectorAll('.modal').forEach(modalElement => {
        new bootstrap.Modal(modalElement);
        
        // Set up scroll fix when modal opens
        modalElement.addEventListener('shown.bs.modal', () => {
            const modalBody = modalElement.querySelector('.modal-body');
            if (modalBody) {
                setupModalBodyScroll(modalBody);
            }
            
            // If it's the WiFi modal, check NetworkManager status
            if (modalElement.id === 'wifi-modal') {
                checkNetworkManagerStatus();
            }
        });
    });
    
    // Add enhanced styling if it doesn't exist
    if (!document.getElementById('enhanced-wifi-styles')) {
        const style = document.createElement('style');
        style.id = 'enhanced-wifi-styles';
        style.textContent = `
            /* Enhanced modal and WiFi styling */
            .active-drag {
                cursor: grabbing !important;
            }
            
            .modal-body {
                overscroll-behavior: contain;
            }
            
            .hover-highlight:hover {
                background-color: rgba(255, 255, 255, 0.15) !important;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .hover-highlight:active {
                transform: translateY(0);
            }
            
            .list-group-item {
                transition: all 0.2s ease;
            }
            
            /* Progress bar animations */
            .progress-bar-animated {
                animation: progress-bar-stripes 1s linear infinite;
            }
            
            @keyframes progress-bar-stripes {
                0% { background-position: 0 0; }
                100% { background-position: 40px 0; }
            }
            
            /* Input validation styling */
            .is-invalid {
                border-color: #dc3545;
                box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
            }
            
            /* Enhanced alert styling */
            .alert {
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
            }
            
            /* Custom scrollbar */
            .modal-body::-webkit-scrollbar {
                width: 6px;
            }
            
            .modal-body::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
            }
            
            .modal-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
            }
            
            .modal-body::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            
            /* Network signal strength colors */
            .text-signal-excellent { color: #28a745 !important; }
            .text-signal-good { color: #17a2b8 !important; }
            .text-signal-fair { color: #ffc107 !important; }
            .text-signal-poor { color: #dc3545 !important; }
            
            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .modal-body {
                    max-height: 60vh !important;
                }
                
                .btn {
                    font-size: 0.9rem;
                }
                
                .hover-highlight:hover {
                    transform: none;
                }
            }
            
            /* Focus states for accessibility */
            .btn:focus,
            .list-group-item:focus {
                box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.5);
                outline: none;
            }
            
            /* Loading spinner customization */
            .spinner-border-sm {
                width: 1rem;
                height: 1rem;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Periodically check connection status when WiFi modal is open
    let statusCheckInterval;
    
    // Set up status checking for WiFi modal
    const wifiModal = document.getElementById('wifi-modal');
    if (wifiModal) {
        wifiModal.addEventListener('shown.bs.modal', () => {
            // Start periodic status checks
            statusCheckInterval = setInterval(() => {
                if (wifiModal.classList.contains('show')) {
                    updateWiFiStatus();
                }
            }, 10000); // Check every 10 seconds
        });
        
        wifiModal.addEventListener('hidden.bs.modal', () => {
            // Stop status checks when modal is closed
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
        });
    }
    
    // Add keyboard shortcuts for better accessibility
    document.addEventListener('keydown', (e) => {
        // ESC key to close modals
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                const bsModal = bootstrap.Modal.getInstance(openModal);
                if (bsModal) {
                    bsModal.hide();
                }
            }
        }
        
        // Ctrl+R to refresh network scan when WiFi modal is open
        if (e.ctrlKey && e.key === 'r') {
            const wifiModal = document.getElementById('wifi-modal');
            if (wifiModal && wifiModal.classList.contains('show')) {
                e.preventDefault();
                scanForNetworks();
            }
        }
    });
    
    // Add tooltips to buttons for better UX
    const buttons = document.querySelectorAll('button[title]');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            if (button.title) {
                // You can add custom tooltip implementation here if needed
            }
        });
    });
    
    console.log('WiFi Settings: Enhanced initialization complete');
});
