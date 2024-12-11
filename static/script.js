// Drag scrolling variables
let isDragging = false;
let startX = 0;
let startY = 0;
let scrollStartLeft = 0;
let scrollStartTop = 0;

// Initialize drag scrolling
function enableDragScroll(container) {
    // Mouse events
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        container.classList.add('active-drag');
        startX = e.clientX; // Capture initial X position
        startY = e.clientY; // Capture initial Y position
        scrollStartLeft = container.scrollLeft; // Current horizontal scroll
        scrollStartTop = container.scrollTop;   // Current vertical scroll
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent text selection
        const dx = e.clientX - startX; // Horizontal movement
        const dy = e.clientY - startY; // Vertical movement
        container.scrollLeft = scrollStartLeft - dx;
        container.scrollTop = scrollStartTop - dy;
    });

    container.addEventListener('mouseup', () => {
        isDragging = false;
        container.classList.remove('active-drag');
    });

    container.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            container.classList.remove('active-drag');
        }
    });

    // Touch events
    container.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        isDragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        scrollStartLeft = container.scrollLeft;
        scrollStartTop = container.scrollTop;
    });

    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        container.scrollLeft = scrollStartLeft - dx;
        container.scrollTop = scrollStartTop - dy;
    });

    container.addEventListener('touchend', () => {
        isDragging = false;
    });

    container.addEventListener('touchcancel', () => {
        isDragging = false;
    });
}

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
        })
        .catch((err) => console.error('Error updating relay states:', err));
}, 5000);

// Reboot or shutdown the system
function controlSystem(action) {
    fetch(`/${action}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch((err) => console.error(`Error performing ${action}:`, err));
}

// Check for updates
function checkForUpdates() {
    fetch('/update')
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch((err) => console.error('Error checking for updates:', err));
}

// Toggle relay
function toggleRelay(relayName) {
    fetch(`/toggle/${relayName}`)
        .then(response => response.json())
        .then(data => {
            const button = document.getElementById(relayName);
            button.className = data.state ? 'btn-relay btn-success' : 'btn-relay btn-danger';
            button.innerText = `${relayName} - ${data.state ? 'ON' : 'OFF'}`;
        })
        .catch((err) => console.error(`Error toggling relay ${relayName}:`, err));
}

// Enable drag scrolling on both container and content elements
document.addEventListener('DOMContentLoaded', () => {
    const content = document.querySelector('.content');     // Target the `.content` for scrolling
    enableDragScroll(content);
});
