const { Client, LocalAuth } = require('whatsapp-web.js');
// Removed qrcode-terminal requirement
const QRCode = require('qrcode'); // For frontend
const config = require('./config');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let client;
let currentQR = null;
let isAuthenticated = false;
let isReady = false;

function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            handleSIGINT: false, // Handle shutdown manually
            authTimeoutMs: 60000,
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED: New session requested');
        currentQR = qr;
        isAuthenticated = false;
        isReady = false;

        // Generate Data URI and emit to all clients
        QRCode.toDataURL(qr, (err, url) => {
            if (!err) {
                io.emit('qr_code', url);
            }
        });
    });

    client.on('ready', () => {
        console.log('CLIENT STATE: READY - Dashboard should be visible');
        currentQR = null;
        isAuthenticated = true;
        isReady = true;
        io.emit('ready');
    });

    client.on('authenticated', () => {
        console.log('CLIENT STATE: AUTHENTICATED - Session active');
        isAuthenticated = true;
        io.emit('authenticated');
    });

    client.on('auth_failure', msg => {
        console.error('CLIENT STATE: AUTH FAILURE', msg);
        isAuthenticated = false;
        io.emit('auth_failure', msg);
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`CLIENT STATE: LOADING ${percent}% - ${message || ''}`);
        io.emit('loading', { percent, message });

        // If we reach 100% but ready hasn't fired in 30 seconds, check state manually
        if (percent === 100 || percent === '100') {
            setTimeout(async () => {
                if (!isReady) {
                    try {
                        console.log('Stuck at 100%? Checking state manually...');
                        const state = await client.getState();
                        console.log('Manual State Check:', state);
                        if (state === 'CONNECTED') {
                            console.log('Forcing ready state (CONNECTED)');
                            isReady = true;
                            isAuthenticated = true;
                            io.emit('ready');
                        }
                    } catch (e) {
                        console.log('Manual state check failed:', e.message);
                    }
                }
            }, 30000);
        }
    });

    client.on('change_state', state => {
        console.log('CLIENT STATE CHANGE:', state);
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        isAuthenticated = false;
        isReady = false;
        currentQR = null;
        io.emit('disconnected', reason);

        // Destroy and re-initialize
        client.destroy();
        initializeClient();
    });

    client.initialize();
}

initializeClient();

io.on('connection', async (socket) => {
    console.log('New connection: Syncing state. isReady:', isReady, 'isAuthenticated:', isAuthenticated);

    // Double check state if authenticated but not ready
    if (isAuthenticated && !isReady) {
        try {
            const state = await client.getState();
            console.log('New connection state check:', state);
            if (state === 'CONNECTED') {
                isReady = true;
                isAuthenticated = true;
                io.emit('ready');
            }
        } catch (e) {
            // Ignore error if client not initialized
        }
    }

    // Send current state to new connection
    if (isReady) {
        socket.emit('ready');
    } else if (isAuthenticated) {
        socket.emit('authenticated');
    } else if (currentQR) {
        QRCode.toDataURL(currentQR, (err, url) => {
            if (!err) {
                socket.emit('qr_code', url);
            }
        });
    }

    // Handle logout request
    // Handle logout request
    socket.on('logout', async () => {
        console.log('Logout requested by client');
        try {
            await client.logout();
            // The disconnected event will handle the rest
        } catch (error) {
            console.error('Logout failed:', error);
            // Force reset if logout fails
            isAuthenticated = false;
            isReady = false;
            currentQR = null;
            io.emit('disconnected', 'forced_logout');
            await client.destroy();
            initializeClient();
        }
    });

    // Manual state check request
    socket.on('check_state', async () => {
        console.log('Client requested manual state check');
        try {
            const state = await client.getState();
            console.log('Manual check result:', state);
            if (state === 'CONNECTED') {
                isReady = true;
                isAuthenticated = true;
                io.emit('ready');
            } else {
                socket.emit('status_update', `Client state: ${state}`);
            }
        } catch (e) {
            socket.emit('status_update', `State check failed: ${e.message}`);
        }
    });
});

app.post('/api/send', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Please authenticated first.' });
    }

    const { numbers, message } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ error: 'Invalid numbers provided' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`Received request to send messages to ${numbers.length} numbers.`);

    try {
        // Run asynchronously to not block response, but for now we wait
        await sendMessages(numbers, message);
        res.json({ success: true, message: 'Messages sent successfully' });
    } catch (error) {
        console.error('Error sending messages:', error);
        res.status(500).json({ error: 'Failed to send messages', details: error.message });
    }
});

async function sendMessages(numbers, message) {
    console.log(`Starting to send messages to ${numbers.length} numbers...`);

    for (const number of numbers) {
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;

        try {
            const isRegistered = await client.isRegisteredUser(formattedNumber);

            if (isRegistered) {
                await client.sendMessage(formattedNumber, message);
                console.log(`Message sent to ${number}`);
            } else {
                console.log(`Number ${number} is not registered on WhatsApp.`);
            }

            const delay = Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1) + config.minDelay);
            console.log(`Waiting for ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));

        } catch (error) {
            console.error(`Failed to send message to ${number}:`, error);
        }
    }
    console.log('Finished sending messages.');
}

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
