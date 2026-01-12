// Import Express.js and Node Fetch
const express = require('express');
const fetch = require('node-fetch'); // npm install node-fetch

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const API_VERSION = 'v19.0';

// WhatsApp API endpoint
const WHATSAPP_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

// Route for GET requests (webhook verification)
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests (receive messages and reply)
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  // Check if it's a WhatsApp business account event
  if (req.body.object === 'whatsapp_business_account') {
    req.body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        // Handle incoming messages
        if (change.field === 'messages' && change.value.messages) {
          const message = change.value.messages[0];
          
          if (message.type === 'text') {
            const senderPhone = message.from;  // Sender's phone number
            const incomingText = message.text.body;  // Message content
            
            console.log(`\n📱 Message from ${senderPhone}: "${incomingText}"`);
            
            // Send immediate reply back to sender
            sendWhatsAppReply(senderPhone, `Echo: You said "${incomingText}"`);
          }
        }
      });
    });
  }

  // Always respond with 200 OK
  res.status(200).end();
});

// Function to send WhatsApp reply
async function sendWhatsAppReply(toPhone, messageText) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'text',
    text: { body: messageText }
  };

  try {
    const response = await fetch(WHATSAPP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`✅ Reply sent to ${toPhone}: "${messageText}"`);
    } else {
      console.error(`❌ Failed to send reply:`, data);
    }
  } catch (error) {
    console.error(`❌ Error sending reply:`, error.message);
  }
}

// Start the server
app.listen(port, () => {
  console.log(`\n🚀 Server listening on port ${port}`);
  console.log(`📍 Webhook URL: https://your-app.onrender.com/`);
  console.log(`🔑 Set these environment variables on Render:`);
  console.log(`   VERIFY_TOKEN=your_verify_token`);
  console.log(`   PHONE_NUMBER_ID=your_phone_number_id`);
  console.log(`   ACCESS_TOKEN=your_permanent_access_token`);
});
