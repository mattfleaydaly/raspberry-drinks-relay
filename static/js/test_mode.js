// Global variable to track all relays state
let allRelaysOn = false;
let testInProgress = false;
let currentModal = null; // Track the current modal instance
let selfTestPoll = null;

// Log message function
function logMessage(message) {
    const logContent = document.getElementById('log-content');
    if (logContent) {
        const now = new Date();
        const time = now.toLocaleTimeString();
        logContent.innerHTML += `<div>${time} - ${message}</div>`;
        
        // Auto scroll to bottom
        const logContainer = logContent.closest('.log-container');
        if (logContainer) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }
}

// Add function to check test status
function checkTestStatus() {
    return fetch('/test-in-progress')
        .then(response => response.json())
        .then(data => {
            testInProgress = data.testing;
            return testInProgress;
        })
        .catch(err => {
            console.error('Error checking test status:', err);
            return false;
        });
}

// Utility function to show a modal
function showModal(title, message) {
    // Hide any existing modal first
    if (currentModal) {
        currentModal.hide();
        currentModal = null;
    }
    
    // Use existing Bootstrap modal
    const modal = document.getElementById('test-modal');
    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body p');
    
    modalTitle.textContent = title;
    modalBody.textContent = message;
    
    // Show modal using Bootstrap
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    currentModal = bsModal;
}

function updateModalMessage(message) {
    const modal = document.getElementById('test-modal');
    if (!modal) return;
    const modalBody = modal.querySelector('.modal-body p');
    if (modalBody) modalBody.textContent = message;
}

// Close modal function
function closeModal() {
    if (currentModal) {
        currentModal.hide();
        currentModal = null;
    }
}

// Toggle individual relay
function toggleRelay(relayName) {
    if (testInProgress) {
        showModal('Test in Progress', 'Please wait for the current test to complete.');
        return;
    }
    
    // Provide immediate visual feedback
    const button = document.getElementById(relayName);
    if (button) {
        button.classList.add('opacity-75');
    }
    
    fetch(`/toggle/${relayName}`)
        .then(response => {
            if (response.status === 409) {
                throw new Error('Test in progress');
            }
            return response.json();
        })
        .then(data => {
            if (button) {
                button.className = `btn w-100 btn-relay ${data.state ? 'btn-success' : 'btn-danger'}`;
                button.innerHTML = `<i class="bi bi-${data.state ? 'toggle-on' : 'toggle-off'}"></i>${relayName}`;
                button.classList.remove('opacity-75');
                
                logMessage(`${relayName} set to ${data.state ? 'ON' : 'OFF'}`);
            }
            updateAllRelaysState();
        })
        .catch(err => {
            console.error('Error toggling relay:', err);
            if (button) {
                button.classList.remove('opacity-75');
            }
            if (err.message === 'Test in progress') {
                showModal('Error', 'Cannot toggle relay while a test is running.');
            }
        });
}

// Toggle all relays
function toggleAll() {
    if (testInProgress) {
        showModal('Test in Progress', 'Please wait for the current test to complete.');
        return;
    }
    
    const newState = !allRelaysOn;
    const toggleAllButton = document.getElementById('toggleAllButton');
    
    if (toggleAllButton) {
        toggleAllButton.classList.add('opacity-75');
    }
    
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
                logMessage(`All relays turned ${newState ? 'ON' : 'OFF'}`);
            }
            if (toggleAllButton) {
                toggleAllButton.classList.remove('opacity-75');
            }
        })
        .catch(err => {
            console.error('Error toggling all relays:', err);
            if (toggleAllButton) {
                toggleAllButton.classList.remove('opacity-75');
            }
            if (err.message === 'Test in progress') {
                showModal('Error', 'Cannot toggle relays while a test is running.');
            }
        });
}

// Update the toggle all button appearance
function updateToggleAllButton() {
    const button = document.getElementById('toggleAllButton');
    if (button) {
        button.innerHTML = `<i class="bi bi-toggles"></i>All ${allRelaysOn ? 'OFF' : 'ON'}`;
    }
}

// Time test function
function timeTest() {
    if (testInProgress) {
        showModal('Test in Progress', 'Please wait for the current test to complete.');
        return;
    }
    
    testInProgress = true;
    disableRelayButtons(true); // Disable relay buttons during the test
    
    // Visual feedback
    const button = document.getElementById('timeTestBtn');
    if (button) {
        button.classList.add('opacity-75');
    }
    
    showModal('Time Test', 'Running time test...'); // Show initial modal
    logMessage('Starting time test...');
    
    fetch('/time-test')
        .then(response => {
            if (response.status === 409) {
                throw new Error('Test in progress');
            }
            return response.json();
        })
        .then(data => {
            testInProgress = false;
            disableRelayButtons(false); // Re-enable relay buttons after the test
            showModal('Time Test Completed', data.status);
            logMessage(`Time test completed: ${data.status}`);
            
            if (button) {
                button.classList.remove('opacity-75');
            }
        })
        .catch(err => {
            console.error('Error performing time test:', err);
            testInProgress = false;
            disableRelayButtons(false);
            
            if (button) {
                button.classList.remove('opacity-75');
            }
            
            if (err.message === 'Test in progress') {
                showModal('Error', 'Another test is currently running. Please wait.');
                logMessage('Time test failed: Another test is running');
            } else {
                showModal('Error', 'Failed to complete time test');
                logMessage('Time test failed: An error occurred');
            }
        });
}

// Self-test function
function selfTest() {
    if (testInProgress) {
        showModal('Test in Progress', 'Please wait for the current test to complete.');
        return;
    }
    
    testInProgress = true;
    disableRelayButtons(true); // Disable relay buttons during the test
    
    // Visual feedback
    const button = document.getElementById('selfTestBtn');
    if (button) {
        button.classList.add('opacity-75');
    }
    
    showModal('Self Test', 'Running relay self test (sequential on/off)...');
    logMessage('Starting relay self test (sequential)...');
    startSelfTestPolling();
    
    fetch('/self-test')
        .then(response => {
            if (response.status === 409) {
                throw new Error('Test in progress');
            }
            return response.json();
        })
        .then(data => {
            testInProgress = false;
            disableRelayButtons(false); // Re-enable relay buttons after the test
            showModal('Self Test Completed', data.status);
            logMessage(`Self test completed: ${data.status}`);
            stopSelfTestPolling();
            
            if (button) {
                button.classList.remove('opacity-75');
            }
        })
        .catch(err => {
            console.error('Error performing self-test:', err);
            testInProgress = false;
            disableRelayButtons(false);
            stopSelfTestPolling();
            
            if (button) {
                button.classList.remove('opacity-75');
            }
            
            if (err.message === 'Test in progress') {
                showModal('Error', 'Another test is currently running. Please wait.');
                logMessage('Self test failed: Another test is running');
            } else {
                showModal('Error', 'Failed to complete self test');
                logMessage('Self test failed: An error occurred');
            }
        });
}

function startSelfTestPolling() {
    if (selfTestPoll) clearInterval(selfTestPoll);
    selfTestPoll = setInterval(() => {
        fetch('/api/self-test-progress')
            .then(res => res.json())
            .then(data => {
                if (!data.active) return;
                const msg = `Testing ${data.relay}: ${data.action} (step ${data.step}/${data.steps})`;
                updateModalMessage(msg);
                logMessage(msg);
            })
            .catch(() => {});
    }, 400);
}

function stopSelfTestPolling() {
    if (selfTestPoll) {
        clearInterval(selfTestPoll);
        selfTestPoll = null;
    }
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
                    button.className = `btn w-100 btn-relay ${state ? 'btn-success' : 'btn-danger'}`;
                    button.innerHTML = `<i class="bi bi-${state ? 'toggle-on' : 'toggle-off'}"></i>${relayName}`;
                }
            }
            updateAllRelaysState();
        })
        .catch(err => console.error('Error updating relay states:', err));
}

// Update whether all relays are on
function updateAllRelaysState() {
    // Get all relay buttons
    const relayButtons = document.querySelectorAll('.btn-relay');
    // Check if all of them have the 'btn-success' class
    allRelaysOn = Array.from(relayButtons).every(button => button.classList.contains('btn-success'));
    updateToggleAllButton();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check test status initially
    checkTestStatus();
    
    // Initialize toggle all button state
    updateRelayStates();
    
    // Add event listeners with proper event handling
    const timeTestBtn = document.getElementById('timeTestBtn');
    const selfTestBtn = document.getElementById('selfTestBtn');
    const toggleAllBtn = document.getElementById('toggleAllButton');
    
    if (timeTestBtn) {
        timeTestBtn.addEventListener('click', function() {
            // Only proceed if the button isn't handling a previous click
            if (!this.classList.contains('opacity-75') && !testInProgress) {
                timeTest();
            }
        });
    }
    
    if (selfTestBtn) {
        selfTestBtn.addEventListener('click', function() {
            // Only proceed if the button isn't handling a previous click
            if (!this.classList.contains('opacity-75') && !testInProgress) {
                selfTest();
            }
        });
    }
    
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', function() {
            // Only proceed if the button isn't handling a previous click
            if (!this.classList.contains('opacity-75') && !testInProgress) {
                toggleAll();
            }
        });
    }
    
    // Setup modal close function for Bootstrap 5
    document.querySelectorAll('[onclick="closeModal()"]').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            closeModal();
        });
    });
    
    // Handle modal hidden event to clean up
    const modalElement = document.getElementById('test-modal');
    if (modalElement) {
        modalElement.addEventListener('hidden.bs.modal', function() {
            currentModal = null;
        });
    }
    
    // Periodically update relay states and check test status
    setInterval(() => {
        if (!testInProgress) {
            updateRelayStates();
            checkTestStatus();
        }
    }, 2000);
    
    // Log initial state
    logMessage('Test mode initialized - ready for operation');
});
