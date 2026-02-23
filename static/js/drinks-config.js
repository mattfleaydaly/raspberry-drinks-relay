// Drinks Configuration - drinks-config.js

// All drinks data 
let drinksData = [];
let currentStepIndex = -1;
let relayOptions = [];
let availableIcons = [
    'bi-cup', 'bi-cup-hot', 'bi-cup-straw', 'bi-cup-fill',
    'bi-droplet', 'bi-droplet-fill', 'bi-water', 'bi-magic',
    'bi-tropical-drink', 'bi-battery-charging', 'bi-lightning',
    'bi-diamond', 'bi-star', 'bi-heart', 'bi-flower1', 'bi-flower2',
    'bi-emoji-smile', 'bi-emoji-laughing', 'bi-emoji-sunglasses',
    'bi-thermometer-high', 'bi-steam'
];

// Scrolling variables from your script.js
let modalDragScroll = {
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollStartLeft: 0,
    scrollStartTop: 0
};

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initModals();
    initEventListeners();
    loadDrinks();
    populateIconGrid();
    setupModalScrolling();
    loadPhotoOptions();
    loadRelayOptions();
});

// Initialize Bootstrap modals
function initModals() {
    // Drink edit modal
    const drinkModal = document.getElementById('drinkModal');
    if (drinkModal) {
        const bsDrinkModal = new bootstrap.Modal(drinkModal);
        
        // Set up scroll fix when modal opens
        drinkModal.addEventListener('shown.bs.modal', () => {
            const modalBody = drinkModal.querySelector('.modal-body');
            setupModalBodyScroll(modalBody);
        });
    }
    
    // Icon selection modal
    const iconModal = document.getElementById('iconModal');
    if (iconModal) {
        const bsIconModal = new bootstrap.Modal(iconModal);
        
        // Set up scroll fix when modal opens
        iconModal.addEventListener('shown.bs.modal', () => {
            const modalBody = iconModal.querySelector('.modal-body');
            setupModalBodyScroll(modalBody);
        });
    }
    
    // Import/Export modal
    const importExportModal = document.getElementById('importExportModal');
    if (importExportModal) {
        const bsImportExportModal = new bootstrap.Modal(importExportModal);
        
        // Set up scroll fix when modal opens
        importExportModal.addEventListener('shown.bs.modal', () => {
            const modalBody = importExportModal.querySelector('.modal-body');
            setupModalBodyScroll(modalBody);
        });
    }
    
    // Time selection modal
    const timeModal = document.getElementById('timeModal');
    if (timeModal) {
        const bsTimeModal = new bootstrap.Modal(timeModal);
    }
}

// Integrate drag scrolling for modal bodies
function setupModalScrolling() {
    // Set up event listener for when any modal is shown
    document.body.addEventListener('shown.bs.modal', (event) => {
        const modalBody = event.target.querySelector('.modal-body');
        if (modalBody) {
            setupModalBodyScroll(modalBody);
        }
    });
}

// Set up scrolling for a specific modal body
function setupModalBodyScroll(modalBody) {
    if (!modalBody) return;
    
    // Reset any previous event listeners
    modalBody.removeEventListener('mousedown', handleScrollMouseDown);
    modalBody.removeEventListener('mousemove', handleScrollMouseMove);
    modalBody.removeEventListener('mouseup', handleScrollMouseUp);
    modalBody.removeEventListener('mouseleave', handleScrollMouseLeave);
    modalBody.removeEventListener('touchstart', handleScrollTouchStart);
    modalBody.removeEventListener('touchmove', handleScrollTouchMove);
    modalBody.removeEventListener('touchend', handleScrollTouchEnd);
    
    // Ensure modal body has proper styling for scrolling
    modalBody.style.overflow = 'auto';
    modalBody.style.overflowX = 'hidden';
    modalBody.style.maxHeight = '60vh';
    modalBody.style.position = 'relative';
    modalBody.style.userSelect = 'none';
    modalBody.style.webkitUserSelect = 'none';
    modalBody.style.touchAction = 'pan-y';
    modalBody.style.webkitOverflowScrolling = 'touch';
    
    // Add event listeners for mouse/touch scrolling
    modalBody.addEventListener('mousedown', handleScrollMouseDown);
    modalBody.addEventListener('mousemove', handleScrollMouseMove);
    modalBody.addEventListener('mouseup', handleScrollMouseUp);
    modalBody.addEventListener('mouseleave', handleScrollMouseLeave);
    
    // Touch events
    modalBody.addEventListener('touchstart', handleScrollTouchStart);
    modalBody.addEventListener('touchmove', handleScrollTouchMove, { passive: false });
    modalBody.addEventListener('touchend', handleScrollTouchEnd);
}

// Mouse event handlers for scrolling
function handleScrollMouseDown(e) {
    // Only enable drag on primary mouse button
    if (e.button !== 0) return;
    
    modalDragScroll.isDragging = true;
    this.classList.add('active-drag');
    modalDragScroll.startX = e.clientX;
    modalDragScroll.startY = e.clientY;
    modalDragScroll.scrollStartLeft = this.scrollLeft;
    modalDragScroll.scrollStartTop = this.scrollTop;
}

function handleScrollMouseMove(e) {
    if (!modalDragScroll.isDragging) return;
    
    e.preventDefault();
    const dx = e.clientX - modalDragScroll.startX;
    const dy = e.clientY - modalDragScroll.startY;
    this.scrollLeft = modalDragScroll.scrollStartLeft - dx;
    this.scrollTop = modalDragScroll.scrollStartTop - dy;
}

function handleScrollMouseUp() {
    modalDragScroll.isDragging = false;
    this.classList.remove('active-drag');
}

function handleScrollMouseLeave() {
    if (modalDragScroll.isDragging) {
        modalDragScroll.isDragging = false;
        this.classList.remove('active-drag');
    }
}

// Touch event handlers for scrolling
function handleScrollTouchStart(e) {
    const touch = e.touches[0];
    modalDragScroll.isDragging = true;
    modalDragScroll.startX = touch.clientX;
    modalDragScroll.startY = touch.clientY;
    modalDragScroll.scrollStartLeft = this.scrollLeft;
    modalDragScroll.scrollStartTop = this.scrollTop;
}

function handleScrollTouchMove(e) {
    if (!modalDragScroll.isDragging) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - modalDragScroll.startX;
    const dy = touch.clientY - modalDragScroll.startY;
    
    // Calculate movement direction
    const isScrollingVertically = Math.abs(dy) > Math.abs(dx);
    
    // If scrolling vertically and we're at the top or bottom edge, don't prevent default
    const isAtTop = this.scrollTop <= 0 && dy > 0;
    const isAtBottom = this.scrollTop >= (this.scrollHeight - this.offsetHeight) && dy < 0;
    
    if (isScrollingVertically && !isAtTop && !isAtBottom) {
        e.preventDefault();
    }
    
    this.scrollTop = modalDragScroll.scrollStartTop - dy;
}

function handleScrollTouchEnd() {
    modalDragScroll.isDragging = false;
}

// Set up all event listeners
function initEventListeners() {
    // Add drink button
    document.getElementById('addDrinkBtn')?.addEventListener('click', () => {
        openDrinkModal();
    });
    
    // Save drink button
    document.getElementById('saveDrinkBtn')?.addEventListener('click', () => {
        saveDrink();
    });
    
    // Delete drink button
    document.getElementById('deleteDrinkBtn')?.addEventListener('click', () => {
        deleteDrink();
    });
    
    // Add relay step button
    document.getElementById('addStepBtn')?.addEventListener('click', () => {
        addRelayStep();
    });
    
    // Import/Export button
    document.getElementById('importExportBtn')?.addEventListener('click', () => {
        openImportExportModal();
    });
    
    // Icon selector dropdown
    document.getElementById('iconSelector')?.addEventListener('change', (e) => {
        updateIconPreview(e.target.value);
    });
    
    // More icons button
    document.getElementById('moreIconsBtn')?.addEventListener('click', () => {
        openIconModal();
    });

    // Photo selector
    document.getElementById('photoPickerBtn')?.addEventListener('click', () => {
        openPhotoPicker();
    });
    document.getElementById('clearPhotoBtn')?.addEventListener('click', () => {
        setSelectedPhoto('');
        const modal = bootstrap.Modal.getInstance(document.getElementById('photoPickerModal'));
        if (modal) modal.hide();
    });
    
    // Copy data button
    document.getElementById('copyDataBtn')?.addEventListener('click', () => {
        copyToClipboard();
    });
    
    // Import data button
    document.getElementById('importDataBtn')?.addEventListener('click', () => {
        importData();
    });
    
    // Time slider
    document.getElementById('timeSlider')?.addEventListener('input', (e) => {
        document.getElementById('timeValue').textContent = e.target.value;
    });
    
    // Time up/down buttons
    document.getElementById('timeUpBtn')?.addEventListener('click', () => {
        const timeValue = document.getElementById('timeValue');
        const slider = document.getElementById('timeSlider');
        const newVal = Math.min(parseInt(timeValue.textContent) + 1, 30);
        timeValue.textContent = newVal;
        slider.value = newVal;
    });
    
    document.getElementById('timeDownBtn')?.addEventListener('click', () => {
        const timeValue = document.getElementById('timeValue');
        const slider = document.getElementById('timeSlider');
        const newVal = Math.max(parseInt(timeValue.textContent) - 1, 1);
        timeValue.textContent = newVal;
        slider.value = newVal;
    });
    
    // Set time button
    document.getElementById('setTimeBtn')?.addEventListener('click', () => {
        const time = parseInt(document.getElementById('timeValue').textContent);
        const timeModal = bootstrap.Modal.getInstance(document.getElementById('timeModal'));
        
        if (currentStepIndex >= 0) {
            const timeInput = document.querySelector(`#relaySteps .relay-step[data-index="${currentStepIndex}"] .time-display`);
            if (timeInput) {
                timeInput.textContent = `${time} s`;
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
    
    if (!drinksList || !noDrinksMessage) return;
    
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
    
    if (!modal || !modalTitle || !drinkForm || !deleteBtn) return;
    
    // Reset form
    drinkForm.reset();
    document.getElementById('relaySteps').innerHTML = '';
    loadPhotoOptions();
    
    if (drinkIndex >= 0 && drinkIndex < drinksData.length) {
        // Edit existing drink
        const drink = drinksData[drinkIndex];
        modalTitle.textContent = 'Edit Drink';
        document.getElementById('drinkId').value = drinkIndex;
        document.getElementById('drinkName').value = drink.name;
        document.getElementById('iconSelector').value = drink.icon;
        updateIconPreview(drink.icon);
        const photoSelector = document.getElementById('photoSelector');
        if (photoSelector) {
            photoSelector.value = drink.image || '';
            updatePhotoPreview(photoSelector.value);
        }
        
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
        const photoSelector = document.getElementById('photoSelector');
        if (photoSelector) {
            photoSelector.value = '';
            updatePhotoPreview('');
        }
        
        // Add default step
        addRelayStep();
        
        deleteBtn.classList.add('d-none');
    }
    
    // Show modal
    const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    bsModal.show();
}

// Load saved photos for selection
function loadPhotoOptions() {
    const selector = document.getElementById('photoSelector');
    if (!selector) return;
    fetch('/api/photo-library/list-saved')
        .then(res => res.json())
        .then(data => {
            if (!data.success) return;
            const current = selector.value;
            selector.value = current || '';
            const grid = document.getElementById('photoPickerGrid');
            if (grid) {
                grid.innerHTML = '';
                data.photos.forEach(photo => {
                    const card = document.createElement('button');
                    card.type = 'button';
                    card.className = 'btn btn-outline w-100';
                    card.style.textAlign = 'left';
                    card.innerHTML = `
                        <img src="${photo.url}" alt="${photo.name}" style="width:100%; height:120px; object-fit:cover; border-radius:10px; margin-bottom:8px;">
                        <div>${photo.folder}/${photo.name}</div>
                    `;
                    card.addEventListener('click', () => {
                        setSelectedPhoto(photo.url);
                        const modal = bootstrap.Modal.getInstance(document.getElementById('photoPickerModal'));
                        if (modal) modal.hide();
                    });
                    grid.appendChild(card);
                });
            }
        })
        .catch(() => {});
}

function updatePhotoPreview(url) {
    const wrap = document.getElementById('photoPreviewWrap');
    const img = document.getElementById('photoPreview');
    if (!wrap || !img) return;
    if (!url) {
        wrap.style.display = 'none';
        img.src = '';
        return;
    }
    img.src = url;
    wrap.style.display = 'block';
}

function openPhotoPicker() {
    loadPhotoOptions();
    const modalEl = document.getElementById('photoPickerModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

function setSelectedPhoto(url) {
    const selector = document.getElementById('photoSelector');
    if (selector) selector.value = url || '';
    updatePhotoPreview(url || '');
}

// Update the icon preview
function updateIconPreview(iconClass) {
    const preview = document.getElementById('selectedIconPreview');
    if (preview) {
        preview.className = iconClass;
    }
}

function loadRelayOptions() {
    fetch('/api/relays')
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.relays)) {
                relayOptions = data.relays;
            }
        })
        .catch(() => {});
}

// Add a relay step to the form
function addRelayStep(relay = 1, time = 5, action = 'on') {
    const relaySteps = document.getElementById('relaySteps');
    if (!relaySteps) return;
    
    const index = relaySteps.children.length;
    
    const stepElement = document.createElement('div');
    stepElement.className = 'relay-step';
    stepElement.dataset.index = index;
    
    const relaySelectOptions = relayOptions.length
        ? relayOptions.map((r, i) => `<option value="${i + 1}" ${relay === i + 1 ? 'selected' : ''}>${r.name}</option>`).join('')
        : `
            <option value="1" ${relay === 1 ? 'selected' : ''}>Relay 1</option>
            <option value="2" ${relay === 2 ? 'selected' : ''}>Relay 2</option>
            <option value="3" ${relay === 3 ? 'selected' : ''}>Relay 3</option>
            <option value="4" ${relay === 4 ? 'selected' : ''}>Relay 4</option>
        `;

    stepElement.innerHTML = `
        <div class="relay-step-header">
            <span>Step ${index + 1}</span>
            <button type="button" class="btn btn-outline-danger" onclick="removeStep(${index})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="row g-3 align-items-end">
            <div class="col-5">
                <label class="form-label">Relay</label>
                <select class="form-select relay-select">
                    ${relaySelectOptions}
                </select>
            </div>
            <div class="col-4">
                <label class="form-label">Time</label>
                <button type="button" class="btn btn-outline w-100 time-display" data-time="${time}"
                        onclick="openTimeModal(${index})">
                    ${time} s
                </button>
            </div>
            <div class="col-3">
                <label class="form-label">Action</label>
                <select class="form-select action-select">
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
    if (!timeDisplay) return;
    
    const currentTime = parseInt(timeDisplay.dataset.time || "5");
    
    const timeValueElement = document.getElementById('timeValue');
    const timeSliderElement = document.getElementById('timeSlider');
    
    if (timeValueElement && timeSliderElement) {
        timeValueElement.textContent = currentTime;
        timeSliderElement.value = currentTime;
    }
    
    const timeModal = document.getElementById('timeModal');
    if (timeModal) {
        const modal = bootstrap.Modal.getInstance(timeModal) || new bootstrap.Modal(timeModal);
        modal.show();
    }
}

// Save the drink
function saveDrink() {
    const drinkIdElement = document.getElementById('drinkId');
    const nameElement = document.getElementById('drinkName');
    const iconElement = document.getElementById('iconSelector');
    
    if (!drinkIdElement || !nameElement || !iconElement) return;
    
    const drinkIndex = drinkIdElement.value;
    const name = nameElement.value.trim();
    const icon = iconElement.value;
    const photoSelector = document.getElementById('photoSelector');
    const image = photoSelector ? photoSelector.value : '';
    
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
        image: image || null,
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
    if (modal) {
        modal.hide();
    }
}

// Delete a drink
async function deleteDrink() {
    const drinkIdElement = document.getElementById('drinkId');
    if (!drinkIdElement) return;
    
    const drinkIndex = parseInt(drinkIdElement.value);
    
    if (isNaN(drinkIndex) || drinkIndex < 0 || drinkIndex >= drinksData.length) {
        return;
    }
    
    // Confirm deletion
    const ok = await window.appConfirm(`Are you sure you want to delete "${drinksData[drinkIndex].name}"?`);
    if (ok) {
        drinksData.splice(drinkIndex, 1);
        saveDrinksToBackend();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('drinkModal'));
        if (modal) {
            modal.hide();
        }
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
    if (!iconGrid) return;
    
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
    const iconModal = document.getElementById('iconModal');
    if (!iconModal) return;
    
    const modal = bootstrap.Modal.getInstance(iconModal) || new bootstrap.Modal(iconModal);
    modal.show();
}

// Select an icon
function selectIcon(iconClass) {
    // Update the selector
    const iconSelector = document.getElementById('iconSelector');
    if (iconSelector) {
        iconSelector.value = iconClass;
        updateIconPreview(iconClass);
    }
    
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
    if (iconModal) {
        iconModal.hide();
    }
}

// Open import/export modal
function openImportExportModal() {
    const exportDataElement = document.getElementById('exportData');
    const importExportModal = document.getElementById('importExportModal');
    
    if (!exportDataElement || !importExportModal) return;
    
    // Populate export data
    exportDataElement.value = JSON.stringify(drinksData, null, 2);
    
    // Show modal
    const modal = bootstrap.Modal.getInstance(importExportModal) || new bootstrap.Modal(importExportModal);
    modal.show();
}

// Copy data to clipboard
function copyToClipboard() {
    const exportData = document.getElementById('exportData');
    if (!exportData) return;
    
    exportData.select();
    document.execCommand('copy');
    showToast('Data copied to clipboard', 'success');
}

// Import data
async function importData() {
    const importDataElement = document.getElementById('importData');
    if (!importDataElement) return;
    
    const importData = importDataElement.value.trim();
    
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
        const ok = await window.appConfirm('This will replace all existing drinks. Continue?');
        if (ok) {
            drinksData = newData;
            saveDrinksToBackend();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('importExportModal'));
            if (modal) {
                modal.hide();
            }
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
