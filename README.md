# WhatsApp Sender Service

A simple Node.js service to send template messages to a list of WhatsApp numbers using your own WhatsApp account.

## Prerequisites

- Node.js installed on your machine.
- A WhatsApp account on your phone.

## Setup

1.  Navigate to the directory:
    ```bash
    cd whatsapp_sender_service
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

Edit `config.js` to set your target numbers and message:

```javascript
module.exports = {
    numbers: [
        '919876543210', // Add numbers here with country code, no + or spaces
        '15551234567'
    ],
    message: "Your custom message here.",
    minDelay: 3000,
    maxDelay: 10000
};
```

## Running the Service

1.  Start the service:
    ```bash
    npm start
    ```

2.  Terminal will show a QR code. Scan it with your WhatsApp (Linked Devices).

3.  The service will start sending messages to the numbers in `config.js` with a random delay between each to mimic human behavior.

## Note

- **Anti-Ban:** Sending too many messages too quickly to people who don't have you saved can get your number banned. Use with caution.
- **Session:** The session is saved locally in `.wwebjs_auth`. You won't need to scan the QR code every time unless you logout or the session expires.
