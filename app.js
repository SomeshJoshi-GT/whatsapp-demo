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
const API_VERSION = process.env.API_VERSION;

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

            // Send reply and capture exact API response
            const replyResult = await sendWhatsAppReply(senderPhone, `Echo: You said "${incomingText}"`);
            
            // Extract response details from the promise result
            apiResponseData = replyResult.data;
            apiResponseStatus = replyResult.status;
            apiResponseHeaders = replyResult.headers;
            
            // Break after first message processing
            break;
          }
        }
      }
      if (apiResponseData !== null) break;
    }
  }

  // Return EXACT WhatsApp API response (body, status, headers)
  res.status(apiResponseStatus).json(apiResponseData);
});

// Function to send WhatsApp reply and return full API response
async function sendWhatsAppReply(toPhone, messageText) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone,
    type: 'text',
    text: { 
      preview_url: true,
      body: messageText 
    }
  };

   // 🔥 PRE-FLIGHT LOGGING: Print URL, Headers, and Body BEFORE API call
  console.log(`\n🚀 === WHATSAPP API REQUEST ===`);
  console.log(`📍 URL: ${WHATSAPP_URL}`);
  console.log(`📋 Headers:`);
  console.log(`   Authorization: Bearer ${ACCESS_TOKEN ? ACCESS_TOKEN.slice(0, 20) + '...' : 'NOT_SET'}`);
  console.log(`   Content-Type: application/json`);
  console.log(`📦 Body: ${JSON.stringify(payload, null, 2)}`);
  console.log(`=====================================\n`);
  
  try {
    const response = await fetch(WHATSAPP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Capture ALL response details
    const data = await response.json();
    const headers = {};
    
    // Copy relevant headers
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    console.log(`✅ Reply sent to ${toPhone}: "${messageText}"`);
    console.log(`📤 WhatsApp API Status: ${response.status}`);
    console.log(`📤 WhatsApp API Response:`, JSON.stringify(data, null, 2));

    return {
      status: response.status,
      data: data,
      headers: headers
    };
  } catch (error) {
    console.error(`❌ Error sending reply:`, error.message);
    return {
      status: 500,
      data: { error: 'Failed to send message', details: error.message },
      headers: {}
    };
  }
}

// Start the server
app.listen(port, () => {
  console.log(`\n🚀 Server listening on port ${port}`);
  console.log(`📍 Webhook URL: https://your-app.onrender.com/`);
});
