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
const API_VERSION = process.env.API_VERSION || 'v22.0'; // Fixed: Added fallback

// WhatsApp support team contact (customize this)
const SUPPORT_CONTACT = process.env.SUPPORT_CONTACT || 'support@gotatva.com';
											 
																		 
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

// Route for POST requests (receive messages and reply) - FIXED: Made async
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  // FIXED: Declare variables at top of function scope
  let apiResponseData = null;
  let apiResponseStatus = 200;
  let apiResponseHeaders = {};

  // Check if it's a WhatsApp business account event
  if (req.body.object === 'whatsapp_business_account') {
    for (const entry of req.body.entry) {  // FIXED: Changed to for...of
      for (const change of entry.changes) {
        // Handle incoming messages
        if (change.field === 'messages' && change.value.messages) {
          const message = change.value.messages[0];
          
          if (message.type === 'text') {
            const senderPhone = message.from;
            const incomingText = message.text.body;
			const originalMessageIdTemp = message.id; // 🔥 CAPTURE ORIGINAL MESSAGE ID
            
            console.log(`\n📱 Message from ${senderPhone}: "${incomingText}"`);
            console.log(`🆔 Original Message ID: ${originalMessageIdTemp}`);

            // 1️⃣ FIRST: Send instant acknowledgement (NO context)
            console.log(`📤 Sending ACKNOWLEDGEMENT to ${senderPhone}`);
            const ackResult = await sendWhatsAppReply(senderPhone, `✅ Thanks for reaching out! We've received your message.`, null);

			const originalMessageId = ackResult.messages[0].id; 
			console.log(`🆔 Returned Message ID: ${originalMessageId}`);

            // 2️⃣ SECOND: Reply to original message with context (30s delay)
            console.log(`⏳ Scheduling REPLY WITH CONTEXT to ${senderPhone} in 30 seconds...`);
            setTimeout(async () => {
              console.log(`📤 Sending CONTEXT REPLY to ${senderPhone}`);
              await sendWhatsAppReply(senderPhone, `📞 Please reach out to our support team at ${SUPPORT_CONTACT} for immediate assistance.`, originalMessageId);
            }, 30000); // 30 seconds

            // Use acknowledgement response for webhook
            apiResponseData = ackResult.data;
            apiResponseStatus = ackResult.status;
            apiResponseHeaders = ackResult.headers;
            
            break; // Break after first message processing
          }
        }
      }
      if (apiResponseData !== null) break;
    }
  }

  // Return EXACT WhatsApp API response from acknowledgement
  res.status(apiResponseStatus).json(apiResponseData || { status: 'no_message_processed' });
});

// Function to send WhatsApp reply (with optional context for replies)
async function sendWhatsAppReply(toPhone, messageText, messageId = null) {
  let payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone,
    type: 'text',
    text: { 
      preview_url: true,
      body: messageText 
    }
  };

  // 🔥 ADD CONTEXT for replies to original message
  if (messageId) {
    payload.context = {
      message_id: messageId
    };
    console.log(`🔗 Adding context: message_id=${messageId}`);
  }

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

    console.log(`✅ Reply sent to ${toPhone}: "${messageText}" ${messageId ? '(WITH CONTEXT)' : '(ACKNOWLEDGEMENT)'}`);
    console.log(`📤 WhatsApp API Status: ${response.status}`);
																			  

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
  console.log(`💬 Reply 1 (0s): "✅ Thanks for reaching out! We've received your message."`);
  console.log(`💬 Reply 2 (30s): "📞 Please reach out to our support team at ${SUPPORT_CONTACT}" (WITH CONTEXT)`);
});
