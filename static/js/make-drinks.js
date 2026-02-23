// Variables to track current drink being made
let currentDrinkId = null;
let currentDrinkName = null;
let currentDrinkTime = 0;
let progressInterval = null;
let progressStartTime = 0;
let progressPhase = -1;
const commentaryPhases = [
    'Warming up the pumps...',
    'Mixing the base...',
    'Balancing flavors...',
    'Finishing the pour...',
    'Almost ready...'
];

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Bootstrap modals
    initModals();
    
    // Add event listeners
    initEventListeners();
});

// Initialize Bootstrap modals
function initModals() {
    // Confirm modal
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        new bootstrap.Modal(confirmModal);
    }
    
    // Complete modal
    const completeModal = document.getElementById('completeModal');
    if (completeModal) {
        new bootstrap.Modal(completeModal);
    }
    
    // Error modal
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        new bootstrap.Modal(errorModal);
    }
}

// Set up event listeners
function initEventListeners() {
    // Make drink buttons
    const makeDrinkButtons = document.querySelectorAll('.make-drink-btn');
    makeDrinkButtons.forEach(button => {
        button.addEventListener('click', () => {
            prepareMakeDrink(button);
        });
    });
    
    // Confirm make button
    const confirmMakeBtn = document.getElementById('confirmMakeBtn');
    if (confirmMakeBtn) {
        confirmMakeBtn.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
            if (modal) {
                modal.hide();
            }
            makeDrink();
        });
    }
}

// Prepare to make a drink
function prepareMakeDrink(button) {
    // Get drink details
    currentDrinkId = button.dataset.drinkId;
    currentDrinkName = button.dataset.drinkName;
    currentDrinkTime = parseInt(button.dataset.totalTime);
    
    // Update confirmation modal message
    const confirmMessage = document.getElementById('confirm-message');
    if (confirmMessage) {
        confirmMessage.textContent = `Are you sure you want to make ${currentDrinkName}?`;
    }
    
    // Show confirmation modal
    const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmModal')) || 
                         new bootstrap.Modal(document.getElementById('confirmModal'));
    confirmModal.show();
}

// Make the drink
function makeDrink() {
    if (currentDrinkId === null) return;
    
    // Disable all make buttons
    const makeDrinkButtons = document.querySelectorAll('.make-drink-btn');
    makeDrinkButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');
    });
    
    // Show status banner
    const statusOverlay = document.getElementById('status-overlay');
    const statusMessage = document.getElementById('status-message');
    const statusSubtitle = document.getElementById('status-subtitle');
    if (statusOverlay) statusOverlay.classList.remove('d-none');
    if (statusMessage) statusMessage.textContent = `Starting ${currentDrinkName}...`;
    if (statusSubtitle) statusSubtitle.textContent = 'Warming up the pumps...';
    
    // Reset progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
    }
    
    // Start progress tracking
    startProgressTracking();
    
    // Send make drink request to server
    fetch(`/api/make-drink/${currentDrinkId}`, {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Let the progress bar continue until completion
            console.log('Making drink:', data.message);
        } else {
            throw new Error(data.error || 'Failed to make drink');
        }
    })
    .catch(error => {
        console.error('Error making drink:', error);
        stopProgressTracking();
        showErrorModal(error.message);
        
        // Hide status banner
        if (statusOverlay) statusOverlay.classList.add('d-none');
        
        // Re-enable all make buttons
        makeDrinkButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');
        });
    });
}

// Start tracking progress
function startProgressTracking() {
    // Record start time
    progressStartTime = Date.now();
    progressPhase = -1;
    
    // Create progress update interval
    progressInterval = setInterval(() => {
        updateProgress();
    }, 100); // Update every 100ms
}

// Update progress bar
function updateProgress() {
    const elapsedTime = (Date.now() - progressStartTime) / 1000; // in seconds
    const percentComplete = Math.min((elapsedTime / currentDrinkTime) * 100, 100);
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percentComplete}%`;
        progressBar.setAttribute('aria-valuenow', percentComplete);
    }

    // Update commentary
    const statusMessage = document.getElementById('status-message');
    const statusSubtitle = document.getElementById('status-subtitle');
    if (statusMessage && currentDrinkName) {
        const nextPhase = percentComplete < 15 ? 0 :
                          percentComplete < 40 ? 1 :
                          percentComplete < 65 ? 2 :
                          percentComplete < 90 ? 3 : 4;
        if (nextPhase !== progressPhase) {
            progressPhase = nextPhase;
            statusMessage.textContent = commentaryPhases[progressPhase];
            if (statusSubtitle) statusSubtitle.textContent = currentDrinkName;
        }
    }
    
    // If complete, stop tracking and show completion
    if (percentComplete >= 100) {
        stopProgressTracking();
        drinkComplete();
    }
}

// Stop tracking progress
function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

// Handle drink completion
function drinkComplete() {
    // Hide status banner
    const statusOverlay = document.getElementById('status-overlay');
    if (statusOverlay) statusOverlay.classList.add('d-none');
    
    // Re-enable all make buttons
    const makeDrinkButtons = document.querySelectorAll('.make-drink-btn');
    makeDrinkButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('disabled');
    });
    
    // Update and show completion modal
    const completeDrinkName = document.getElementById('complete-drink-name');
    if (completeDrinkName) {
        completeDrinkName.textContent = `Your ${currentDrinkName} is ready!`;
    }
    
    const completeModal = bootstrap.Modal.getInstance(document.getElementById('completeModal')) || 
                          new bootstrap.Modal(document.getElementById('completeModal'));
    completeModal.show();

    // Auto-dismiss after a short time
    setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('completeModal'));
        if (modal) modal.hide();
    }, 3500);
    
    // Reset current drink
    currentDrinkId = null;
    currentDrinkName = null;
    currentDrinkTime = 0;
}

// Show error modal with message
function showErrorModal(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message || 'An error occurred while making your drink.';
    }
    
    const errorModal = bootstrap.Modal.getInstance(document.getElementById('errorModal')) || 
                       new bootstrap.Modal(document.getElementById('errorModal'));
    errorModal.show();
}
