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
