// Drag scrolling variables
let isDragging = false;
let startX = 0;
let startY = 0;
let scrollStartLeft = 0;
let scrollStartTop = 0;

// Initialize drag scrolling
function enableDragScroll(container) {
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        container.classList.add('active-drag');
        startX = e.clientX;
        startY = e.clientY;
        scrollStartLeft = container.scrollLeft;
        scrollStartTop = container.scrollTop;
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
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
        .catch(err => console.error('Error updating relay states:', err));
}, 5000);

// Reboot or shutdown the system
function controlSystem(action) {
    fetch(`/${action}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error(`Error performing ${action}:`, err));
}

// Check for updates
function checkForUpdates() {
    fetch('/update')
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error('Error checking for updates:', err));
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
        .catch(err => console.error(`Error toggling relay ${relayName}:`, err));
}

// Time test function
function timeTest() {
    fetch('/time-test')
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error('Error performing time test:', err));
}

// Self-test function
function selfTest() {
    fetch('/self-test')
        .then(response => response.json())
        .then(data => alert(data.status))
        .catch(err => console.error('Error performing self-test:', err));
}

// Enable drag scrolling on both container and content elements
document.addEventListener('DOMContentLoaded', () => {
    const content = document.querySelector('.content');
    enableDragScroll(content);

    // Add buttons for testing
    const testContainer = document.querySelector('.grid');
    const timeTestButton = document.createElement('button');
    timeTestButton.className = 'btn-action';
    timeTestButton.innerText = 'Time Test';
    timeTestButton.onclick = timeTest;
    testContainer.appendChild(timeTestButton);

    const selfTestButton = document.createElement('button');
    selfTestButton.className = 'btn-action';
    selfTestButton.innerText = 'Self-Test';
    selfTestButton.onclick = selfTest;
    testContainer.appendChild(selfTestButton);
});
