const socket = io();

// UI Elements
const loginSection = document.getElementById('loginSection');
const initializingSection = document.getElementById('initializingSection');
const dashboardSection = document.getElementById('dashboardSection');
const qrCodeImg = document.getElementById('qrCode');
const loadingQR = document.getElementById('loadingQR');
const logoutBtn = document.getElementById('logoutBtn');
const checkStateBtn = document.getElementById('checkStateBtn');
const statusDiv = document.getElementById('status');

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('qr_code', (url) => {
    console.log('QR Code received');
    showLogin();
    qrCodeImg.src = url;
    qrCodeImg.style.display = 'block';
    loadingQR.style.display = 'none';
});

socket.on('ready', () => {
    console.log('Socket: Ready event received');
    showDashboard();
});

socket.on('authenticated', () => {
    console.log('Socket: Authenticated event received');
    const loadingStatus = document.querySelector('#initializingSection .status');
    if (loadingStatus) {
        loadingStatus.textContent = 'Authenticated! Initializing WhatsApp...';
    }
    showInitializing();
});

socket.on('loading', (data) => {
    console.log('Socket: Loading event received', data);
    const loadingStatus = document.querySelector('#initializingSection .status');
    if (loadingStatus) {
        loadingStatus.textContent = `Initializing: ${data.percent}% - ${data.message || 'Please wait...'}`;
    }

    // Fallback: If 100% but not ready, show the check status button
    if (data.percent === 100) {
        setTimeout(() => {
            if (dashboardSection.style.display !== 'block') {
                console.log('Still not ready after 100% loading, enabling check status button');
                checkStateBtn.style.display = 'block';
            }
        }, 15000);
    }
});

socket.on('status_update', (msg) => {
    console.log('Status update received:', msg);
    const loadingStatus = document.querySelector('#initializingSection .status');
    if (loadingStatus) {
        loadingStatus.textContent = msg;
    }
});

socket.on('disconnected', (reason) => {
    console.log('Disconnected', reason);
    if (reason === 'forced_logout') {
        alert('You have been logged out.');
    }
    showLogin();
    // Reset QR state
    qrCodeImg.style.display = 'none';
    loadingQR.style.display = 'block';
    loadingQR.textContent = 'Waiting for new session...';
});


// Helper Functions
function showLogin() {
    loginSection.style.display = 'block';
    initializingSection.style.display = 'none';
    dashboardSection.style.display = 'none';
}

function showInitializing() {
    loginSection.style.display = 'none';
    initializingSection.style.display = 'block';
    dashboardSection.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    initializingSection.style.display = 'none';
    dashboardSection.style.display = 'block';
}

// Status Check Handler
checkStateBtn.addEventListener('click', () => {
    checkStateBtn.textContent = 'Checking...';
    socket.emit('check_state');
    setTimeout(() => {
        checkStateBtn.textContent = 'Still waiting? Click to check status';
    }, 3000);
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        socket.emit('logout');
    }
});

// Form Submission (Existing Logic)
document.getElementById('senderForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const numbersInput = document.getElementById('numbers').value;
    const messageInput = document.getElementById('message').value;

    // Reset status
    statusDiv.className = 'status loading';
    statusDiv.textContent = 'Sending messages...';
    statusDiv.style.display = 'block';

    // Parse numbers: split by newline or comma, trim whitespace, filter empty
    const numbers = numbersInput.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);

    if (numbers.length === 0) {
        statusDiv.className = 'status error';
        statusDiv.textContent = 'Please enter at least one valid phone number.';
        return;
    }

    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numbers, message: messageInput })
        });

        const result = await response.json();

        if (response.ok) {
            statusDiv.className = 'status success';
            statusDiv.textContent = `Success! ${result.message}`;
        } else {
            statusDiv.className = 'status error';
            statusDiv.textContent = `Error: ${result.error || 'Failed to send messages'}`;
        }
    } catch (error) {
        statusDiv.className = 'status error';
        statusDiv.textContent = `Network Error: ${error.message}`;
    }
});
