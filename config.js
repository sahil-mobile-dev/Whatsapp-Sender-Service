module.exports = {
    // List of phone numbers to send messages to.
    // Format: 'countrycodeandnumber', e.g., '1234567890' (US), '919876543210' (India)
    // Don't include '+' or '-' or spaces.
    numbers: [
        '919724296249',
        '917043382913'
    ],

    // Template message. Use {{name}} as a placeholder if you want to customize (requires more complex logic, keeping it simple for now)
    // For this basic version, we just send a static message.
    // modifications can be added later to support dynamic fields if needed.
    message: "Hello! This is a test message from my WhatsApp Sender Service.",

    // Delay between messages in milliseconds (randomized slightly to look human)
    minDelay: 3000,
    maxDelay: 10000
};
