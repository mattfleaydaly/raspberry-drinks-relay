// Variables to track current drink being made
let currentDrinkId = null;
let currentDrinkName = null;
let currentDrinkTime = 0;
let progressInterval = null;
let progressStartTime = 0;
let progressPhase = -1;
let serverPoll = null;
let serverActive = false;
let lastCommentaryAt = 0;
const commentaryCooldownMs = 2200;
const commentaryPhases = [
    [
        'Warming up the pumps...',
        'Priming the flow...',
        'Engaging beverage thrusters...',
        'Kickstarting the mix...',
        'Letting the machines do their thing...',
        'Igniting pour protocol...',
        'Booting the liquid engine...'
    ],
    [
        'Mixing the base...',
        'Laying down the foundation...',
        'Summoning the main pour...',
        'Stirring up something dangerous...',
        'Dialing in the good stuff...',
        'Building the backbone...',
        'Foundation is going down...'
    ],
    [
        'Balancing flavors...',
        'Adding a little chaos...',
        'Fine-tuning the brew...',
        'Leveling up the vibe...',
        'Adjusting the flavor matrix...',
        'Tuning the legend...',
        'Flavor calibration in progress...'
    ],
    [
        'Finishing the pour...',
        'Pouring with purpose...',
        'Closing out the mix...',
        'Final calibration...',
        'Last pass, no mercy...',
        'Final strokes of greatness...',
        'Topping it off like a pro...'
    ],
    [
        'Almost ready...',
        'Final moments...',
        'Just about there...',
        'Brace yourself...',
        'The legend is about to be served...',
        'Get the glass ready...',
        'Victory is pouring...'
    ]
];

const commentarySubtitles = [
    'Boys club special in progress.',
    'Crafting chaos, one pour at a time.',
    'Respect the pour.',
    'Grip the cup. Greatness incoming.',
    'This machine does not miss.',
    'Mr G approved. Zero hesitation.',
    'Engineered for legends.',
    'Pouring with confidence.',
    'If it pours, it scores.'
];

const lastPick = new Map();
function pickRandom(list, key = 'default') {
    if (!list.length) return '';
    const prev = lastPick.get(key);
    let next = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && next === prev) {
        next = list[(list.indexOf(prev) + 1) % list.length];
    }
    lastPick.set(key, next);
    return next;
}

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
    currentDrinkTime = parseFloat(button.dataset.totalTime);
    if (!Number.isFinite(currentDrinkTime) || currentDrinkTime <= 0) {
        currentDrinkTime = 8;
    }
    
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
    startServerProgressPolling();
    
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
            const estimate = Number.isFinite(data.estimated_time) ? data.estimated_time : data.total_time;
            if (estimate && Number.isFinite(estimate)) {
                currentDrinkTime = Math.max(3, estimate);
            }
            // Let the progress bar continue until completion
            console.log('Making drink:', data.message);
        } else {
            throw new Error(data.error || 'Failed to make drink');
        }
    })
        .catch(error => {
            console.error('Error making drink:', error);
            stopProgressTracking();
            stopServerProgressPolling();
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
    const safeTotal = Math.max(3, currentDrinkTime);
    const percentComplete = Math.min((elapsedTime / safeTotal) * 100, 100);
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percentComplete}%`;
        progressBar.setAttribute('aria-valuenow', percentComplete);
    }

    if (serverPoll) {
        return;
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
            statusMessage.textContent = pickRandom(commentaryPhases[progressPhase], `phase-${progressPhase}`);
            if (statusSubtitle) {
                statusSubtitle.textContent = `${currentDrinkName} • ${pickRandom(commentarySubtitles, 'subtitle')}`;
            }
        }
    }
    
    // If complete, stop tracking and show completion
    if (percentComplete >= 100 && elapsedTime >= safeTotal) {
        stopProgressTracking();
        // Small buffer so it never feels like it cuts off early
        setTimeout(() => drinkComplete(), 800);
    }
}

// Stop tracking progress
function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function startServerProgressPolling() {
    if (serverPoll) clearInterval(serverPoll);
    serverActive = true;
    serverPoll = setInterval(() => {
        fetch('/api/drink-progress')
            .then(res => res.json())
            .then(data => {
                if (!data.active) {
                    if (serverActive) {
                        serverActive = false;
                        stopServerProgressPolling();
                        stopProgressTracking();
                        setTimeout(() => drinkComplete(), 800);
                    }
                    return;
                }
                const progressBar = document.getElementById('progress-bar');
                if (progressBar) {
                    progressBar.style.width = `${data.percent}%`;
                    progressBar.setAttribute('aria-valuenow', data.percent);
                }
                const statusMessage = document.getElementById('status-message');
                const statusSubtitle = document.getElementById('status-subtitle');
                const now = Date.now();
                if (statusMessage && now - lastCommentaryAt > commentaryCooldownMs) {
                    const phaseIndex = Math.min(4, Math.floor((data.percent / 100) * 5));
                    statusMessage.textContent = pickRandom(commentaryPhases[phaseIndex], `phase-${phaseIndex}`);
                    lastCommentaryAt = now;
                }
                if (statusSubtitle && data.drink_name) {
                    statusSubtitle.textContent = `${data.drink_name} • Step ${data.current_step}/${data.steps}`;
                }
                serverActive = true;
            })
            .catch(() => {});
    }, 500);
}

function stopServerProgressPolling() {
    if (serverPoll) {
        clearInterval(serverPoll);
        serverPoll = null;
    }
    serverActive = false;
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
