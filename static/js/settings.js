// Reboot or shutdown the system
function controlSystem(action) {
    if (confirm(`Are you sure you want to ${action} the system?`)) {
        fetch(`/${action}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => alert(data.status))
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
    
    const eventSource = new EventSource('/system-update-logs');
    
    eventSource.onmessage = (event) => {
        const logEntry = document.createElement('div');
        logEntry.textContent = event.data;
        updateLogs.appendChild(logEntry);
        updateLogs.scrollTop = updateLogs.scrollHeight; // Auto-scroll to the latest log
    };
    
    eventSource.onerror = () => {
        eventSource.close();
        updateLogs.innerHTML += "System update completed or an error occurred.\n";
        updateLogs.innerHTML += "System will reboot automatically.\n";
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

// Open WiFi Config Modal
function openWiFiConfig() {
    const modal = document.getElementById('wifi-modal');
    const bsModal = new bootstrap.Modal(modal);
    
    // Scan for networks when opening the modal
    scanForNetworks();
    
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
    modalBody.style.maxHeight = '60vh';
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

// Scan for available WiFi networks
function scanForNetworks() {
    const networksContainer = document.getElementById('networks-container');
    const scanBtn = document.getElementById('scan-networks-btn');
    
    if (networksContainer) {
        networksContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-light" role="status"></div><p class="mt-2">Scanning for networks...</p></div>';
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
                    networksContainer.innerHTML = '<div class="alert alert-warning">No networks found</div>';
                    return;
                }
                
                let html = '<div class="list-group">';
                
                data.networks.forEach(network => {
                    const signalStrength = getSignalStrengthIcon(network.signal);
                    const securityIcon = network.security ? '<i class="bi bi-lock-fill ms-2"></i>' : '';
                    
                    html += `
                        <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center bg-dark text-white border-secondary" 
                                onclick="connectToNetwork('${network.ssid}', ${network.security})">
                            <div>
                                <span>${network.ssid}</span>
                                ${securityIcon}
                            </div>
                            <div>
                                ${signalStrength}
                            </div>
                        </button>
                    `;
                });
                
                html += '</div>';
                networksContainer.innerHTML = html;
            } else {
                networksContainer.innerHTML = `<div class="alert alert-danger">${data.error || 'Failed to scan networks'}</div>`;
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
                networksContainer.innerHTML = '<div class="alert alert-danger">Error scanning networks</div>';
            }
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Scan Again';
            }
        });
}

// Get signal strength icon based on signal level
function getSignalStrengthIcon(signal) {
    // Signal is expected to be in dBm, typically between -30 (strong) to -90 (weak)
    if (signal >= -50) {
        return '<i class="bi bi-wifi fs-5"></i>';
    } else if (signal >= -65) {
        return '<i class="bi bi-wifi-2 fs-5"></i>';
    } else if (signal >= -75) {
        return '<i class="bi bi-wifi-1 fs-5"></i>';
    } else {
        return '<i class="bi bi-wifi fs-5 text-warning"></i>';
    }
}

// Connect to a WiFi network
function connectToNetwork(ssid, requiresPassword) {
    const networksContainer = document.getElementById('networks-container');
    
    if (requiresPassword) {
        // Show password input form
        if (networksContainer) {
            networksContainer.innerHTML = `
                <div class="card bg-dark border-secondary">
                    <div class="card-header">Connect to "${ssid}"</div>
                    <div class="card-body">
                        <form id="wifi-password-form">
                            <div class="mb-3">
                                <label for="wifi-password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="wifi-password" required>
                            </div>
                            <div class="d-flex justify-content-between">
                                <button type="button" class="btn btn-secondary" onclick="scanForNetworks()">Cancel</button>
                                <button type="button" class="btn btn-primary" onclick="submitWiFiConnection('${ssid}')">Connect</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        }
    } else {
        // Connect directly if no password is required
        connectWithPassword(ssid, '');
    }
    
    // Fix scrolling after updating content
    const modalBody = document.querySelector('#wifi-modal .modal-body');
    if (modalBody) {
        setupModalBodyScroll(modalBody);
    }
}

// Submit WiFi connection with password
function submitWiFiConnection(ssid) {
    const passwordInput = document.getElementById('wifi-password');
    const password = passwordInput ? passwordInput.value : '';
    
    connectWithPassword(ssid, password);
}

// Connect to network with the provided password
function connectWithPassword(ssid, password) {
    const networksContainer = document.getElementById('networks-container');
    
    if (networksContainer) {
        networksContainer.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-light" role="status"></div>
                <p class="mt-2">Connecting to "${ssid}"...</p>
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
                <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill me-2"></i> Connected to "${ssid}"
                    <div class="mt-2">
                        <small>${data.message || 'Connection successful'}</small>
                    </div>
                </div>
            `;
        } else if (networksContainer) {
            networksContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> Connection failed
                    <div class="mt-2">
                        <small>${data.error || 'Failed to connect to network'}</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-light mt-2" onclick="scanForNetworks()">Try Again</button>
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
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> Connection error
                    <div class="mt-2">
                        <small>An error occurred while trying to connect</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-light mt-2" onclick="scanForNetworks()">Try Again</button>
                </div>
            `;
        }
    });
}

// Load WiFi configuration from USB
function loadWiFiConfigFromUSB() {
    fetch('/load-usb-wifi-config', { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.message))
        .catch(err => console.error('Error loading WiFi config from USB:', err));
}

// Reset all network settings
function resetNetworkSettings() {
    if (!confirm('Are you sure you want to reset all network settings?')) return;
    fetch('/reset-network-settings', { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.message))
        .catch(err => console.error('Error resetting network settings:', err));
}

// Initialize modals when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modals
    document.querySelectorAll('.modal').forEach(modalElement => {
        new bootstrap.Modal(modalElement);
        
        // Set up scroll fix when modal opens
        modalElement.addEventListener('shown.bs.modal', () => {
            const modalBody = modalElement.querySelector('.modal-body');
            if (modalBody) {
                setupModalBodyScroll(modalBody);
            }
        });
    });
    
    // Add dragging class to CSS if it doesn't exist
    if (!document.getElementById('drag-styles')) {
        const style = document.createElement('style');
        style.id = 'drag-styles';
        style.textContent = `
            .active-drag {
                cursor: grabbing !important;
            }
            .modal-body {
                overscroll-behavior: contain;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Periodically check connection status on the WiFi page
    setInterval(() => {
        const wifiModal = document.getElementById('wifi-modal');
        if (wifiModal && wifiModal.classList.contains('show')) {
            fetch('/wifi-status')
                .then(response => response.json())
                .then(data => {
                    const statusElement = document.getElementById('wifi-status');
                    if (statusElement) {
                        if (data.connected) {
                            statusElement.innerHTML = `
                                <div class="alert alert-success mb-0">
                                    <i class="bi bi-wifi"></i> Connected to <strong>${data.ssid}</strong>
                                    <div><small>IP: ${data.ip}</small></div>
                                </div>
                            `;
                        } else {
                            statusElement.innerHTML = `
                                <div class="alert alert-warning mb-0">
                                    <i class="bi bi-wifi-off"></i> Not connected to any WiFi network
                                </div>
                            `;
                        }
                    }
                })
                .catch(err => {
                    console.error('Error checking WiFi status:', err);
                });
        }
    }, 5000);
});
