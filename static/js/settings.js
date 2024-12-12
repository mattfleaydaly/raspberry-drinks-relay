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
    updateModal.style.display = 'block'; // Show the update modal

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
    updateModal.style.display = 'none';
}

// Open WiFi Config Modal
function openWiFiConfig() {
    const modal = document.getElementById('wifi-modal');
    modal.style.display = 'block';
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

// Helper to filter and combine duplicate networks
function filterNetworks(networks) {
    const uniqueNetworks = {};
    networks.forEach(network => {
        if (network && !uniqueNetworks[network]) {
            uniqueNetworks[network] = true;
        }
    });
    return Object.keys(uniqueNetworks);
}

// Fetch and display available networks
function fetchAvailableNetworks() {
    fetch('/wifi-networks')
        .then(response => response.json())
        .then(data => {
            const networksDiv = document.getElementById('wifi-networks');
            networksDiv.innerHTML = ''; // Clear previous list
            const uniqueNetworks = filterNetworks(data.networks || []);
            if (uniqueNetworks.length) {
                uniqueNetworks.forEach(network => {
                    const networkItem = document.createElement('div');
                    networkItem.className = 'wifi-item';
                    networkItem.innerHTML = `
                        <span class="network-name">${network}</span>
                        <button class="btn-action" onclick="selectWiFiNetwork('${network}')">Connect</button>
                    `;
                    networksDiv.appendChild(networkItem);
                });
            } else {
                networksDiv.innerHTML = '<p>No networks found.</p>';
            }
        })
        .catch(err => {
            console.error('Error fetching WiFi networks:', err);
            document.getElementById('wifi-networks').innerHTML = '<p>Error fetching networks.</p>';
        });
}

// Fetch and display saved networks (excluding Ethernet)
function fetchSavedNetworks() {
    fetch('/saved-networks')
        .then(response => response.json())
        .then(data => {
            const savedNetworksDiv = document.getElementById('saved-networks-list');
            savedNetworksDiv.innerHTML = '';
            const wifiNetworks = data.networks.filter(network => !network.toLowerCase().includes('ethernet'));
            if (wifiNetworks.length) {
                wifiNetworks.forEach(network => {
                    const networkDiv = document.createElement('div');
                    networkDiv.className = 'wifi-item';
                    networkDiv.innerHTML = `
                        <span>${network}</span>
                        <button class="btn-action" onclick="connectToSavedNetwork('${network}')">Connect</button>
                        <button class="btn-action" onclick="disconnectNetwork('${network}')">Disconnect</button>
                        <button class="btn-action" onclick="deleteSavedNetwork('${network}')">Delete</button>
                    `;
                    savedNetworksDiv.appendChild(networkDiv);
                });
            } else {
                savedNetworksDiv.innerHTML = '<p>No saved networks found.</p>';
            }
        })
        .catch(err => console.error('Error fetching saved networks:', err));
}

// Select a WiFi network
function selectWiFiNetwork(network) {
    const passwordInput = document.getElementById('wifi-password');
    passwordInput.dataset.network = network;
    passwordInput.value = ''; // Clear the password field
    alert(`Selected network: ${network}`);
}

// Connect to WiFi
function connectToWiFi() {
    const network = document.getElementById('wifi-password').dataset.network;
    const password = document.getElementById('wifi-password').value;

    if (!network || !password) {
        alert('Please select a network and enter a password.');
        return;
    }

    fetch('/connect-wifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network, password }),
    })
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error('Error connecting to WiFi:', err));
}

// Connect to a saved network
function connectToSavedNetwork(network) {
    fetch('/connect-saved-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network }),
    })
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error(`Error connecting to saved network ${network}:`, err));
}

// Disconnect from a network
function disconnectNetwork(network) {
    fetch('/disconnect-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network }),
    })
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error(`Error disconnecting network ${network}:`, err));
}

// Delete a saved network
function deleteSavedNetwork(network) {
    fetch('/delete-saved-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network }),
    })
        .then(response => response.json())
        .then(data => {
            alert(data.status);
            fetchSavedNetworks(); // Refresh saved networks list
        })
        .catch(err => console.error('Error deleting network:', err));
}

// Close WiFi modal
function closeWiFiModal() {
    const modal = document.getElementById('wifi-modal');
    modal.style.display = 'none';
}

// Toggle the on-screen keyboard visibility
function toggleKeyboard() {
    const keyboard = document.getElementById('onscreen-keyboard');
    keyboard.classList.toggle('hidden');
}

// On-screen keyboard initialization
document.addEventListener('DOMContentLoaded', () => {
    const keyboardContainer = document.getElementById('onscreen-keyboard');
    const passwordInput = document.getElementById('wifi-password');
    const keys = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', '_'],
    ];

    keys.forEach(row => {
        const rowDiv = document.createElement('div');
        row.forEach(key => {
            const keyButton = document.createElement('button');
            keyButton.className = 'key-btn';
            keyButton.innerText = key;
            keyButton.onclick = () => (passwordInput.value += key);
            rowDiv.appendChild(keyButton);
        });
        keyboardContainer.appendChild(rowDiv);
    });

    const backspaceButton = document.createElement('button');
    backspaceButton.className = 'key-btn';
    backspaceButton.innerText = '⌫';
    backspaceButton.onclick = () => (passwordInput.value = passwordInput.value.slice(0, -1));
    keyboardContainer.appendChild(backspaceButton);

    const clearButton = document.createElement('button');
    clearButton.className = 'key-btn';
    clearButton.innerText = 'Clear';
    clearButton.onclick = () => (passwordInput.value = '');
    keyboardContainer.appendChild(clearButton);
});

// Initialize drag scrolling for modal content
document.addEventListener('DOMContentLoaded', () => {
    const modalContent = document.querySelector('.modal-content.content');
    if (modalContent) enableDragScroll(modalContent);
});
