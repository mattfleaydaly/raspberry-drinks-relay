// Global variable to track all relays state
let allRelaysOn = false;

// Add function to check test status
function checkTestStatus() {
    return fetch('/test-in-progress')
        .then(response => response.json())
        .then(data => data.testing);
}

// Utility function to show a modal
function showModal(title, message) {
    // Use existing Bootstrap modal instead of creating a new one
    const modal = document.getElementById('test-modal');
    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body p');
    
    modalTitle.textContent = title;
    modalBody.textContent = message;
    
    // Show modal using Bootstrap
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Utility function to close the modal
function closeModal() {
    const modal = document.getElementById('test-modal');
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
        bsModal.hide();
        // Remove modal backdrop if it exists
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        // Remove modal-open class from body
        document.body.classList.remove('modal-open');
        // Remove inline style from body
        document.body.style.removeProperty('padding-right');
    }
}

// Toggle individual relay
function toggleRelay(relayName) {
    checkTestStatus().then(testing => {
        if (testing) {
            showModal('Test in Progress', 'Please wait for the current test to complete.');
            return;
        }
        
        fetch(`/toggle/${relayName}`)
            .then(response => {
                if (response.status === 409) {
                    throw new Error('Test in progress');
                }
                return response.json();
            })
            .then(data => {
                const button = document.getElementById(relayName);
                if (button) {
                    button.className = `btn w-100 py-3 btn-relay ${data.state ? 'btn-success' : 'btn-danger'}`;
                    button.innerText = `${relayName} - ${data.state ? 'ON' : 'OFF'}`;
                }
            })
            .catch(err => {
                console.error('Error toggling relay:', err);
                if (err.message === 'Test in progress') {
                    showModal('Error', 'Cannot toggle relay while a test is running.');
                }
            });
    });
}

// Toggle all relays
function toggleAll() {
    checkTestStatus().then(testing => {
        if (testing) {
            showModal('Test in Progress', 'Please wait for the current test to complete.');
            return;
        }
        
        const newState = !allRelaysOn;
        fetch(`/toggle-all/${newState ? 'on' : 'off'}`)
            .then(response => {
                if (response.status === 409) {
                    throw new Error('Test in progress');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    allRelaysOn = newState;
                    updateToggleAllButton();
                    updateRelayStates();
                }
            })
            .catch(err => {
                console.error('Error toggling all relays:', err);
                if (err.message === 'Test in progress') {
                    showModal('Error', 'Cannot toggle relays while a test is running.');
                }
            });
    });
}

// Update the toggle all button appearance
function updateToggleAllButton() {
    const button = document.getElementById('toggleAllButton');
    if (button) {
        button.innerText = `All ${allRelaysOn ? 'OFF' : 'ON'}`;
    }
}

// Time test function
function timeTest() {
    checkTestStatus().then(testing => {
        if (testing) {
            showModal('Test in Progress', 'Please wait for the current test to complete.');
            return;
        }
        
        disableRelayButtons(true); // Disable relay buttons during the test
        showModal('Time Test', 'Running time test...'); // Show initial modal
        
        fetch('/time-test')
            .then(response => {
                if (response.status === 409) {
                    throw new Error('Test in progress');
                }
                return response.json();
            })
            .then(data => {
                disableRelayButtons(false); // Re-enable relay buttons after the test
                showModal('Time Test Completed', data.status);
            })
            .catch(err => {
                console.error('Error performing time test:', err);
                disableRelayButtons(false);
                if (err.message === 'Test in progress') {
                    showModal('Error', 'Another test is currently running. Please wait.');
                } else {
                    showModal('Error', 'Failed to complete time test');
                }
            });
    });
}

// Self-test function
function selfTest() {
    checkTestStatus().then(testing => {
        if (testing) {
            showModal('Test in Progress', 'Please wait for the current test to complete.');
            return;
        }
        
        disableRelayButtons(true); // Disable relay buttons during the test
        showModal('Self Test', 'Running self test (10 seconds)...'); // Show initial modal
        
        fetch('/self-test')
            .then(response => {
                if (response.status === 409) {
                    throw new Error('Test in progress');
                }
                return response.json();
            })
            .then(data => {
                disableRelayButtons(false); // Re-enable relay buttons after the test
                showModal('Self Test Completed', data.status);
            })
            .catch(err => {
                console.error('Error performing self-test:', err);
                disableRelayButtons(false);
                if (err.message === 'Test in progress') {
                    showModal('Error', 'Another test is currently running. Please wait.');
                } else {
                    showModal('Error', 'Failed to complete self test');
                }
            });
    });
}

// Disable or enable relay buttons
function disableRelayButtons(disable) {
    const buttons = document.querySelectorAll('.btn-relay, #toggleAllButton');
    buttons.forEach(button => {
        button.disabled = disable;
        if (disable) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    });
}

// Update relay states dynamically during tests
function updateRelayStates() {
    fetch('/get-states')
        .then(response => response.json())
        .then(states => {
            for (const [relayName, state] of Object.entries(states)) {
                const button = document.getElementById(relayName);
                if (button) {
                    // Update with consistent Bootstrap classes
                    button.className = `btn w-100 py-3 btn-relay ${state ? 'btn-success' : 'btn-danger'}`;
                    button.innerText = `${relayName} - ${state ? 'ON' : 'OFF'}`;
                }
            }

            // Update all relays state based on whether all relays are on
            allRelaysOn = Object.values(states).every(state => state === true);
            updateToggleAllButton();
        })
        .catch(err => console.error('Error updating relay states:', err));
}

// Periodically update relay states (for ongoing tests)
setInterval(updateRelayStates, 1000);

// Initialize Bootstrap components and add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modals
    document.querySelectorAll('.modal').forEach(modalElement => {
        new bootstrap.Modal(modalElement);
    });

    // Add click event listeners using more specific selectors
    const timeTestButton = document.querySelector('button[onclick="timeTest()"]');
    const selfTestButton = document.querySelector('button[onclick="selfTest()"]');
    const toggleAllButton = document.querySelector('button[onclick="toggleAll()"]');
    
    if (timeTestButton) timeTestButton.addEventListener('click', timeTest);
    if (selfTestButton) selfTestButton.addEventListener('click', selfTest);
    if (toggleAllButton) toggleAllButton.addEventListener('click', toggleAll);

    // Initialize toggle all button state
    updateToggleAllButton();
});
