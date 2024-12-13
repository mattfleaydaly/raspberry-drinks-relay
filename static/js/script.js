// Drag scrolling variables
let isDragging = false;
let startX = 0;
let startY = 0;
let scrollStartLeft = 0;
let scrollStartTop = 0;

// Initialize drag scrolling
function enableDragScroll(container) {
    if (!container) return;

    // Ensure container is scrollable
    container.style.overflow = 'auto';
    container.style.userSelect = 'none';
    container.style.webkitUserSelect = 'none';
    container.style.mozUserSelect = 'none';
    container.style.msUserSelect = 'none';

    container.addEventListener('mousedown', (e) => {
        // Only enable drag on primary mouse button
        if (e.button !== 0) return;
        
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

    // Touch events for mobile devices
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
        e.preventDefault(); // Prevent default scroll behavior
    }, { passive: false });

    container.addEventListener('touchend', () => {
        isDragging = false;
    });

    container.addEventListener('touchcancel', () => {
        isDragging = false;
    });
}

// Initialize navigation buttons
function initializeNavButtons() {
    const backBtn = document.getElementById('backBtn');
    const homeBtn = document.getElementById('homeBtn');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }

    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
}

// Periodically update relay states
setInterval(() => {
    fetch('/get-states')
        .then(response => response.json())
        .then(states => {
            for (const [relay, state] of Object.entries(states)) {
                const button = document.getElementById(relay);
                if (button) {
                    // Update with Bootstrap classes
                    button.className = `btn w-100 py-3 btn-relay ${state ? 'btn-success' : 'btn-danger'}`;
                    button.innerText = `${relay} - ${state ? 'ON' : 'OFF'}`;
                }
            }
        })
        .catch(err => console.error('Error updating relay states:', err));
}, 5000);

// Toggle relay
function toggleRelay(relayName) {
    fetch(`/toggle/${relayName}`)
        .then(response => response.json())
        .then(data => {
            const button = document.getElementById(relayName);
            // Update with Bootstrap classes
            button.className = `btn w-100 py-3 btn-relay ${data.state ? 'btn-success' : 'btn-danger'}`;
            button.innerText = `${relayName} - ${data.state ? 'ON' : 'OFF'}`;
        })
        .catch(err => console.error(`Error toggling relay ${relayName}:`, err));
}

// Enable drag scrolling on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize navigation buttons
    initializeNavButtons();
    
    // Enable drag scrolling on main container
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        enableDragScroll(mainContainer);
    }
    
    // Enable drag scrolling on any modal content
    const modalContents = document.querySelectorAll('.modal-dialog');
    modalContents.forEach(content => {
        enableDragScroll(content);
    });
});

// Prevent default touch behavior to avoid unwanted scrolling
document.addEventListener('touchmove', (e) => {
    if (isDragging) {
        e.preventDefault();
    }
}, { passive: false });

// Re-initialize drag scrolling when modals are shown
document.addEventListener('shown.bs.modal', (event) => {
    const modalDialog = event.target.querySelector('.modal-dialog');
    if (modalDialog) {
        enableDragScroll(modalDialog);
    }
});
