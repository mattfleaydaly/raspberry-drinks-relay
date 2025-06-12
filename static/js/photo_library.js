document.addEventListener('DOMContentLoaded', loadLibrary);

function loadLibrary() {
    fetch('/api/photo-library/manage', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
    }).then(res => res.json())
      .then(data => updateLibraryView(data.data));
}

function updateLibraryView(data) {
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = data.folders.map(f => `<option>${f}</option>`).join('');

    const photosContainer = document.getElementById('photosContainer');
    photosContainer.innerHTML = '';

    data.folders.forEach(folder => {
        photosContainer.innerHTML += `<h4>${folder}</h4><div class="row" id="folder-${folder}"></div>`;
        const folderRow = document.getElementById(`folder-${folder}`);
        Object.entries(data.photos).forEach(([photo, pFolder]) => {
            if (pFolder === folder) {
                folderRow.innerHTML += `
                    <div class="col-md-3">
                        <img src="/photos/albums/${folder}/${photo}" class="img-thumbnail">
                        <button onclick="deletePhoto('${photo}')">Delete</button>
                    </div>`;
            }
        });
    });
}

function uploadPhotos() {
    const files = document.getElementById('photoUpload').files;
    const folder = document.getElementById('folderSelect').value;
    const formData = new FormData();
    for (let i=0; i<files.length; i++) formData.append('photos', files[i]);
    formData.append('folder', folder);

    fetch('/api/photo-library/upload', {method: 'POST', body: formData})
        .then(() => loadLibrary());
}

function importFromUSB() {
    const folder = document.getElementById('folderSelect').value;
    fetch('/api/photo-library/import-usb', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({folder})
    }).then(() => loadLibrary());
}

function deletePhoto(photo) {
    fetch('/api/photo-library/manage', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action:'delete_photo', photo})
    }).then(() => loadLibrary());
}
