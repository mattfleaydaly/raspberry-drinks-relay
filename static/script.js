// Drag scrolling variables
let isDragging = false;
let startX, startY;
let scrollLeft, scrollTop;

// Initialize drag scrolling
function enableDragScroll(container) {
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        container.classList.add('active-drag'); // Add visual feedback
        startX = e.pageX - container.offsetLeft; // Mouse X position
        startY = e.pageY - container.offsetTop; // Mouse Y position
        scrollLeft = container.scrollLeft; // Current scroll position
        scrollTop = container.scrollTop;
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent text selection
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        const walkX = x - startX; // Horizontal movement
        const walkY = y - startY; // Vertical movement
        container.scrollLeft = scrollLeft - walkX; // Apply horizontal scroll
        container.scrollTop = scrollTop - walkY; // Apply vertical scroll
    });

    container.addEventListener('mouseup', () => {
        isDragging = false;
        container.classList.remove('active-drag'); // Remove visual feedback
    });

    container.addEventListener('mouseleave', () => {
        isDragging = false;
        container.classList.remove('active-drag'); // Ensure drag ends on leave
    });

    // Touch support
    container.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.pageX - container.offsetLeft;
        startY = touch.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
    });

    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const x = touch.pageX - container.offsetLeft;
        const y = touch.pageY - container.offsetTop;
        const walkX = x - startX;
        const walkY = y - startY;
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
    });

    container.addEventListener('touchend', () => {
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

// Enable drag scrolling on the container
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.container'); // Target the scrollable container
    enableDragScroll(container);
});
