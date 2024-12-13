// Reboot or shutdown the system
function controlSystem(action) {
    fetch(`/${action}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error(`Error performing ${action}:`, err));
}

// Check for updates
function checkForUpdates() {
    fetch('/check-updates')
        .then(response => response.json())
        .then(data => {
            const checkUpdatesBtn = document.getElementById('check-updates-btn');
            const systemUpdateBtn = document.getElementById('system-update-btn');

            if (data.updatesAvailable) {
                checkUpdatesBtn.classList.add('btn-success');
                checkUpdatesBtn.disabled = false;

                systemUpdateBtn.classList.add('btn-success');
                systemUpdateBtn.disabled = false;
            } else {
                alert('System is up-to-date.');
                checkUpdatesBtn.classList.remove('btn-success');
                checkUpdatesBtn.disabled = true;

                systemUpdateBtn.classList.remove('btn-success');
                systemUpdateBtn.disabled = true;
            }
        })
        .catch(err => console.error('Error checking for updates:', err));
}

// Perform system update with terminal-like logs
function performSystemUpdate() {
    const updateModal = document.getElementById('update-modal');
    const updateLogs = document.getElementById('update-logs');
    updateLogs.innerHTML = ""; // Clear previous logs
    
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
        alert('System update completed or an error occurred.');
        closeUpdateModal();
        controlSystem('reboot'); // Reboot the system after the update
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
    bsModal.show();
}

// Close WiFi modal
function closeWiFiModal() {
    const modal = document.getElementById('wifi-modal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
        bsModal.hide();
    }
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
    });
});
