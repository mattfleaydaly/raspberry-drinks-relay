// Periodically update relay states
setInterval(() => {
    fetch('/get-states')
        .then(response => response.json())
        .then(states => {
            for (const [relay, state] of Object.entries(states)) {
                const button = document.getElementById(relay);
                if (button) {
                    button.className = state ? 'btn-relay btn-success' : 'btn-relay btn-danger';
                    button.innerText = `${relay} - ${state ? 'ON' : 'OFF'}`;
                }
            }
        });
}, 5000);

// Reboot or shutdown the system
function controlSystem(action) {
    fetch(`/${action}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.status));
}

// Check for updates
function checkForUpdates() {
    fetch('/update')
        .then(response => response.json())
        .then(data => alert(data.status));
}

// Toggle relay
function toggleRelay(relayName) {
    fetch(`/toggle/${relayName}`)
        .then(response => response.json())
        .then(data => {
            const button = document.getElementById(relayName);
            button.className = data.state ? 'btn-relay btn-success' : 'btn-relay btn-danger';
            button.innerText = `${relayName} - ${data.state ? 'ON' : 'OFF'}`;
        });
}
