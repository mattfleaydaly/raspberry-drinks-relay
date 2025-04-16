// Drinks Configuration - drinks-config.js

// All drinks data 
let drinksData = [];
let currentStepIndex = -1;
let availableIcons = [
    'bi-cup', 'bi-cup-hot', 'bi-cup-straw', 'bi-cup-fill',
    'bi-droplet', 'bi-droplet-fill', 'bi-water', 'bi-magic',
    'bi-tropical-drink', 'bi-battery-charging', 'bi-lightning',
    'bi-diamond', 'bi-star', 'bi-heart', 'bi-flower1', 'bi-flower2',
    'bi-emoji-smile', 'bi-emoji-laughing', 'bi-emoji-sunglasses',
    'bi-thermometer-high', 'bi-steam'
];

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initModals();
    initEventListeners();
    loadDrinks();
    populateIconGrid();
    initTouchScroll();
});

// Initialize Bootstrap modals
function initModals() {
    // Drink edit modal
    const drinkModal = document.getElementById('drinkModal');
    const bsDrinkModal = new bootstrap.Modal(drinkModal);
    
    // Icon selection modal
    const iconModal = document.getElementById('iconModal');
    const bsIconModal = new bootstrap.Modal(iconModal);
    
    // Import/Export modal
    const importExportModal = document.getElementById('importExportModal');
    const bsImportExportModal = new bootstrap.Modal(importExportModal);
    
    // Time selection modal
    const timeModal = document.getElementById('timeModal');
    const bsTimeModal = new bootstrap.Modal(timeModal);
}

// Set up all event listeners
function initEventListeners() {
    // Add drink button
    document.getElementById('addDrinkBtn').addEventListener('click', () => {
        openDrinkModal();
    });
    
    // Save drink button
    document.getElementById('saveDrinkBtn').addEventListener('click', () => {
        saveDrink();
    });
    
    // Delete drink button
    document.getElementById('deleteDrinkBtn').addEventListener('click', () => {
        deleteDrink();
    });
    
    // Add relay step button
    document.getElementById('addStepBtn').addEventListener('click', () => {
        addRelayStep();
    });
    
    // Import/Export button
    document.getElementById('importExportBtn').addEventListener('click', () => {
        openImportExportModal();
    });
    
    // Icon selector dropdown
    document.getElementById('iconSelector').addEventListener('change', (e) => {
        updateIconPreview(e.target.value);
    });
    
    // More icons button
    document.getElementById('moreIconsBtn').addEventListener('click', () => {
        openIconModal();
    });
    
    // Copy data button
    document.getElementById('copyDataBtn').addEventListener('click', () => {
        copyToClipboard();
    });
    
    // Import data button
    document.getElementById('importDataBtn').addEventListener('click', () => {
        importData();
    });
    
    // Time slider
    document.getElementById('timeSlider').addEventListener('input', (e) => {
        document.getElementById('timeValue').textContent = e.target.value;
    });
    
    // Time up/down buttons
    document.getElementById('timeUpBtn').addEventListener('click', () => {
        const timeValue = document.getElementById('timeValue');
        const slider = document.getElementById('timeSlider');
        const newVal = Math.min(parseInt(timeValue.textContent) + 1, 30);
        timeValue.textContent = newVal;
        slider.value = newVal;
    });
    
    document.getElementById('timeDownBtn').addEventListener('click', () => {
        const timeValue = document.getElementById('timeValue');
        const slider = document.getElementById('timeSlider');
        const newVal = Math.max(parseInt(timeValue.textContent) - 1, 1);
        timeValue.textContent = newVal;
        slider.value = newVal;
    });
    
    // Set time button
    document.getElementById('setTimeBtn').addEventListener('click', () => {
        const time = parseInt(document.getElementById('timeValue').textContent);
        const timeModal = bootstrap.Modal.getInstance(document.getElementById('timeModal'));
        
        if (currentStepIndex >= 0) {
            const timeInput = document.querySelector(`#relaySteps .relay-step[data-index="${currentStepIndex}"] .time-display`);
            if (timeInput) {
                timeInput.textContent = time;
                timeInput.dataset.time = time;
            }
        }
        
        timeModal.hide();
    });
}

// Load drinks data from backend
function loadDrinks() {
    fetch('/api/drinks')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                drinksData = data.drinks || [];
                renderDrinksList();
            } else {
                showToast('Error loading drinks', 'danger');
            }
        })
        .catch(error => {
            console.error('Error loading drinks:', error);
            // If API fails, try loading from localStorage for development
            const storedDrinks = localStorage.getItem('drinksData');
            if (storedDrinks) {
                try {
                    drinksData = JSON.parse(storedDrinks);
                    renderDrinksList();
                } catch (e) {
                    drinksData = [];
                }
            }
        });
}

// Render the list of drinks
function renderDrinksList() {
    const drinksList = document.getElementById('drinksList');
    const noDrinksMessage = document.getElementById('no-drinks-message');
    
    if (drinksData.length === 0) {
        drinksList.innerHTML = '';
        noDrinksMessage.style.display = 'block';
        return;
    }
    
    noDrinksMessage.style.display = 'none';
    
    let html = '';
    drinksData.forEach((drink, index) => {
        html += `
            <button class="list-group-item list-group-item-action d-flex align-items-center" 
                    data-index="${index}" onclick="editDrink(${index})">
                <i class="${drink.icon} me-3 fs-4"></i>
                <div class="ms-2 me-auto">
                    <div class="fw-bold">${drink.name}</div>
                    <small class="text-muted">${drink.steps.length} steps</small>
                </div>
                <i class="bi bi-chevron-right text-muted"></i>
            </button>
        `;
    });
    
    drinksList.innerHTML = html;
}

// Open drink modal for adding a new drink
function openDrinkModal(drinkIndex = -1) {
    const modal = document.getElementById('drinkModal');
    const modalTitle = document.getElementById('drinkModalTitle');
    const drinkForm = document.getElementById('drinkForm');
    const deleteBtn = document.getElementById('deleteDrinkBtn');
    
    // Reset form
    drinkForm.reset();
    document.getElementById('relaySteps').innerHTML = '';
    
    if (drinkIndex >= 0 && drinkIndex < drinksData.length) {
        // Edit existing drink
        const drink = drinksData[drinkIndex];
        modalTitle.textContent = 'Edit Drink';
        document.getElementById('drinkId').value = drinkIndex;
        document.getElementById('drinkName').value = drink.name;
        document.getElementById('iconSelector').value = drink.icon;
        updateIconPreview(drink.icon);
        
        // Populate steps
        drink.steps.forEach((step, index) => {
            addRelayStep(step.relay, step.time, step.action);
        });
        
        deleteBtn.classList.remove('d-none');
    } else {
        // Add new drink
        modalTitle.textContent = 'Add Drink';
        document.getElementById('drinkId').value = '';
        updateIconPreview('bi-cup');
        
        // Add default step
        addRelayStep();
        
        deleteBtn.classList.add('d-none');
    }
    
    // Show modal
    const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    bsModal.show();
}

// Update the icon preview
function updateIconPreview(iconClass) {
    const preview = document.getElementById('selectedIconPreview');
    preview.className = iconClass;
}

// Add a relay step to the form
function addRelayStep(relay = 1, time = 5, action = 'on') {
    const relaySteps = document.getElementById('relaySteps');
    const index = relaySteps.children.length;
    
    const stepElement = document.createElement('div');
    stepElement.className = 'relay-step';
    stepElement.dataset.index = index;
    
    stepElement.innerHTML = `
        <div class="relay-step-header">
            <span>Step ${index + 1}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeStep(${index})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="row g-2">
            <div class="col-5">
                <label class="form-label small">Relay</label>
                <select class="form-select form-select-sm relay-select">
                    <option value="1" ${relay === 1 ? 'selected' : ''}>Relay 1</option>
                    <option value="2" ${relay === 2 ? 'selected' : ''}>Relay 2</option>
                    <option value="3" ${relay === 3 ? 'selected' : ''}>Relay 3</option>
                    <option value="4" ${relay === 4 ? 'selected' : ''}>Relay 4</option>
                </select>
            </div>
            <div class="col-4">
                <label class="form-label small">Time (s)</label>
                <div class="input-group input-group-sm">
                    <span class="form-control time-display" data-time="${time}" 
                          onclick="openTimeModal(${index})">${time}</span>
                    <span class="input-group-text">s</span>
                </div>
            </div>
            <div class="col-3">
                <label class="form-label small">Action</label>
                <select class="form-select form-select-sm action-select">
                    <option value="on" ${action === 'on' ? 'selected' : ''}>ON</option>
                    <option value="off" ${action === 'off' ? 'selected' : ''}>OFF</option>
                </select>
            </div>
        </div>
    `;
    
    relaySteps.appendChild(stepElement);
}

// Remove a relay step
function removeStep(index) {
    const steps = document.querySelectorAll('#relaySteps .relay-step');
    if (steps.length <= 1) {
        showToast('You need at least one step', 'warning');
        return;
    }
    
    steps[index].remove();
    
    // Update step numbers
    document.querySelectorAll('#relaySteps .relay-step').forEach((step, i) => {
        step.dataset.index = i;
        step.querySelector('.relay-step-header span').textContent = `Step ${i + 1}`;
        step.querySelector('button').setAttribute('onclick', `removeStep(${i})`);
        
        const timeDisplay = step.querySelector('.time-display');
        timeDisplay.setAttribute('onclick', `openTimeModal(${i})`);
    });
}

// Open the time selection modal
function openTimeModal(stepIndex) {
    currentStepIndex = stepIndex;
    const timeDisplay = document.querySelector(`#relaySteps .relay-step[data-index="${stepIndex}"] .time-display`);
    const currentTime = parseInt(timeDisplay.dataset.time || "5");
    
    document.getElementById('timeValue').textContent = currentTime;
    document.getElementById('timeSlider').value = currentTime;
    
    const timeModal = bootstrap.Modal.getInstance(document.getElementById('timeModal')) || 
                        new bootstrap.Modal(document.getElementById('timeModal'));
    timeModal.show();
}

// Save the drink
function saveDrink() {
    const drinkIndex = document.getElementById('drinkId').value;
    const name = document.getElementById('drinkName').value.trim();
    const icon = document.getElementById('iconSelector').value;
    
    if (!name) {
        showToast('Please enter a drink name', 'warning');
        return;
    }
    
    // Collect steps
    const steps = [];
    document.querySelectorAll('#relaySteps .relay-step').forEach((stepElement) => {
        const relay = parseInt(stepElement.querySelector('.relay-select').value);
        const time = parseInt(stepElement.querySelector('.time-display').dataset.time || "5");
        const action = stepElement.querySelector('.action-select').value;
        
        steps.push({
            relay,
            time,
            action
        });
    });
    
    if (steps.length === 0) {
        showToast('Please add at least one step', 'warning');
        return;
    }
    
    // Create drink object
    const drink = {
        name,
        icon,
        steps
    };
    
    // Update or add drink
    if (drinkIndex !== '') {
        drinksData[parseInt(drinkIndex)] = drink;
    } else {
        drinksData.push(drink);
    }
    
    // Save to backend
    saveDrinksToBackend();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('drinkModal'));
    modal.hide();
}

// Delete a drink
function deleteDrink() {
    const drinkIndex = parseInt(document.getElementById('drinkId').value);
    
    if (isNaN(drinkIndex) || drinkIndex < 0 || drinkIndex >= drinksData.length) {
        return;
    }
    
    // Confirm deletion
    if (confirm(`Are you sure you want to delete "${drinksData[drinkIndex].name}"?`)) {
        drinksData.splice(drinkIndex, 1);
        saveDrinksToBackend();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('drinkModal'));
        modal.hide();
    }
}

// Save drinks data to backend
function saveDrinksToBackend() {
    fetch('/api/drinks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ drinks: drinksData })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            renderDrinksList();
            showToast('Drinks saved successfully', 'success');
        } else {
            showToast('Error saving drinks', 'danger');
        }
    })
    .catch(error => {
        console.error('Error saving drinks:', error);
        
        // If API fails, save to localStorage for development
        localStorage.setItem('drinksData', JSON.stringify(drinksData));
        renderDrinksList();
        showToast('Drinks saved to local storage', 'success');
    });
}

// Open drink for editing
function editDrink(index) {
    openDrinkModal(index);
}

// Populate the icon grid
function populateIconGrid() {
    const iconGrid = document.getElementById('iconGrid');
    let html = '';
    
    availableIcons.forEach(icon => {
        html += `
            <div class="icon-item" data-icon="${icon}" onclick="selectIcon('${icon}')">
                <i class="${icon}"></i>
            </div>
        `;
    });
    
    iconGrid.innerHTML = html;
}

// Open the icon selection modal
function openIconModal() {
    const iconModal = bootstrap.Modal.getInstance(document.getElementById('iconModal')) || 
                      new bootstrap.Modal(document.getElementById('iconModal'));
    iconModal.show();
}

// Select an icon
function selectIcon(iconClass) {
    // Update the selector
    document.getElementById('iconSelector').value = iconClass;
    updateIconPreview(iconClass);
    
    // Highlight selected icon
    document.querySelectorAll('.icon-item').forEach(item => {
        if (item.dataset.icon === iconClass) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // Close icon modal
    const iconModal = bootstrap.Modal.getInstance(document.getElementById('iconModal'));
    iconModal.hide();
}

// Open import/export modal
function openImportExportModal() {
    // Populate export data
    document.getElementById('exportData').value = JSON.stringify(drinksData, null, 2);
    
    // Show modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('importExportModal')) || 
                  new bootstrap.Modal(document.getElementById('importExportModal'));
    modal.show();
}

// Copy data to clipboard
function copyToClipboard() {
    const exportData = document.getElementById('exportData');
    exportData.select();
    document.execCommand('copy');
    showToast('Data copied to clipboard', 'success');
}

// Import data
function importData() {
    const importData = document.getElementById('importData').value.trim();
    
    if (!importData) {
        showToast('No data to import', 'warning');
        return;
    }
    
    try {
        const newData = JSON.parse(importData);
        
        if (!Array.isArray(newData)) {
            throw new Error('Data must be an array');
        }
        
        // Validate each drink
        newData.forEach(drink => {
            if (!drink.name || !drink.icon || !Array.isArray(drink.steps)) {
                throw new Error('Invalid drink format');
            }
        });
        
        // Confirm import
        if (confirm('This will replace all existing drinks. Continue?')) {
            drinksData = newData;
            saveDrinksToBackend();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('importExportModal'));
            modal.hide();
        }
    } catch (error) {
        showToast('Invalid JSON data', 'danger');
        console.error('Import error:', error);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Check if toast container exists, create if not
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toastId = 'toast-' + Date.now();
    const toastElement = document.createElement('div');
    toastElement.className = `toast bg-${type} text-white`;
    toastElement.id = toastId;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    
    toastElement.innerHTML = `
        <div class="toast-header bg-${type} text-white">
            <strong class="me-auto">Notification</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    toastContainer.appendChild(toastElement);
    
    // Initialize and show toast
    const toastInstance = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
    toastInstance.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Make functions globally accessible for inline event handlers
window.editDrink = editDrink;
window.removeStep = removeStep;
window.openTimeModal = openTimeModal;
window.selectIcon = selectIcon;

// Initialize touch scrolling for modals
function initTouchScroll() {
    // Apply custom touch scrolling to modal content
    const modalBodies = document.querySelectorAll('.modal-body');
    
    modalBodies.forEach(body => {
        // Variables to track touch position
        let startY = 0;
        let scrollTop = 0;
        
        // Touch start event
        body.addEventListener('touchstart', function(e) {
            startY = e.touches[0].pageY;
            scrollTop = this.scrollTop;
            
            // Allow native scrolling to work first
            e.stopPropagation();
        }, { passive: true });
        
        // Touch move event
        body.addEventListener('touchmove', function(e) {
            // Calculate distance moved
            const touchY = e.touches[0].pageY;
            const distance = startY - touchY;
            
            // Scroll the element
            this.scrollTop = scrollTop + distance;
            
            // If we've actually scrolled, prevent default to avoid body scrolling
            if (Math.abs(distance) > 5) {
                if ((this.scrollTop === 0 && distance < 0) || 
                   (this.scrollTop >= (this.scrollHeight - this.offsetHeight) && distance > 0)) {
                    // At the boundary, allow parent scrolling
                } else {
                    // Not at boundary, prevent parent scrolling
                    e.stopPropagation();
                }
            }
        }, { passive: true });
    });
}
