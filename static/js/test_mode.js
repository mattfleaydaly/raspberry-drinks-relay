// Utility function to show a modal
function showModal(title, message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${title}</h2>
            <p>${message}</p>
            <button class="btn-action" onclick="closeModal()">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

// Utility function to close the modal
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
}

// Time test function
function timeTest() {
    disableRelayButtons(true); // Disable relay buttons during the test
    fetch('/time-test')
        .then(response => response.json())
        .then(data => {
            disableRelayButtons(false); // Re-enable relay buttons after the test
            showModal('Time Test Completed', data.status); // Show modal on completion
        })
        .catch(err => {
            console.error('Error performing time test:', err);
            disableRelayButtons(false);
        });
}

// Self-test function
function selfTest() {
    disableRelayButtons(true); // Disable relay buttons during the test
    fetch('/self-test')
        .then(response => response.json())
        .then(data => {
            disableRelayButtons(false); // Re-enable relay buttons after the test
            showModal('Self Test Completed', data.status); // Show modal on completion
        })
        .catch(err => {
            console.error('Error performing self-test:', err);
            disableRelayButtons(false);
        });
}

// Disable or enable relay buttons
function disableRelayButtons(disable) {
    const relayButtons = document.querySelectorAll('.btn-relay');
    relayButtons.forEach(button => {
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
                    button.className = state ? 'btn-relay btn-success' : 'btn-relay btn-danger';
                    button.innerText = `${relayName} - ${state ? 'ON' : 'OFF'}`;
                }
            }
        })
        .catch(err => console.error('Error updating relay states:', err));
}

// Periodically update relay states (for ongoing tests)
setInterval(updateRelayStates, 1000);

// Add event listeners for buttons on the Test Mode page
document.addEventListener('DOMContentLoaded', () => {
    const timeTestButton = document.querySelector('.btn-action:nth-child(1)');
    const selfTestButton = document.querySelector('.btn-action:nth-child(2)');

    if (timeTestButton) timeTestButton.addEventListener('click', timeTest);
    if (selfTestButton) selfTestButton.addEventListener('click', selfTest);
});
