document.addEventListener('DOMContentLoaded', () => {
    const keyboardContainer = document.getElementById('onscreen-keyboard');
    const passwordInput = document.getElementById('wifi-password');

    const keys = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', '_'],
    ];

    function renderKeyboard() {
        keyboardContainer.innerHTML = '';
        keys.forEach((row) => {
            const rowDiv = document.createElement('div');
            row.forEach((key) => {
                const keyButton = document.createElement('button');
                keyButton.className = 'key-btn';
                keyButton.innerText = key;
                keyButton.onclick = () => (passwordInput.value += key);
                rowDiv.appendChild(keyButton);
            });
            keyboardContainer.appendChild(rowDiv);
        });

        const backspaceButton = document.createElement('button');
        backspaceButton.className = 'key-btn';
        backspaceButton.innerText = '⌫';
        backspaceButton.onclick = () => (passwordInput.value = passwordInput.value.slice(0, -1));
        keyboardContainer.appendChild(backspaceButton);

        const clearButton = document.createElement('button');
        clearButton.className = 'key-btn';
        clearButton.innerText = 'Clear';
        clearButton.onclick = () => (passwordInput.value = '');
        keyboardContainer.appendChild(clearButton);
    }

    renderKeyboard();
});
