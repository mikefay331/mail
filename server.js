const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { Resend } = require('resend');

const app = express();
const port = process.env.PORT || 3000;

// Constants
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_W4xX3Kwp_tdpzCnwDKc1zLTSsQw34NVrx';
const FROM_EMAIL = process.env.FROM_EMAIL || 'mailcoin@resend.dev';
const VERIFIED_EMAIL = 'vloneawge2005@gmail.com'; // Your verified email address

// Initialize Resend
const resend = new Resend(RESEND_API_KEY);

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Load email template
const emailTemplatePath = path.join(__dirname, 'email-template.html');
let emailTemplate = '';

try {
  emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');
  console.log('Email template loaded successfully');
} catch (error) {
  console.error('Error loading email template:', error);
  emailTemplate = '<div style="text-align: center; padding: 20px;"><h1>BUY $MAIL</h1><p>Get your MAILCOIN now!</p></div>';
  console.log('Using fallback email template');
}

// API route for sending test emails
app.post('/api/send-test', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }
    
    // Check if email is the verified one
    const isVerified = email.toLowerCase() === VERIFIED_EMAIL.toLowerCase();
    
    // For demo purposes: if not verified, show warning but continue with test mode
    if (!isVerified) {
      console.log(`Warning: Attempting to send to non-verified email: ${email}`);
      console.log(`In test mode, Resend will only deliver to: ${VERIFIED_EMAIL}`);
      
      // Option 1: Return error to client explaining limitation
      return res.status(400).json({
        success: false,
        error: `Free Resend tier can only send to ${VERIFIED_EMAIL}. Please enter this email for testing.`,
        details: 'To send to any email address, verify a domain at resend.com/domains'
      });
      
      // Option 2: If you want to continue with the request anyway, remove the return statement above
      // and uncomment this line: email = VERIFIED_EMAIL; // Override with verified email
    }
    
    console.log(`Attempting to send test email to verified address: ${email}`);
    
    const { data, error } = await resend.emails.send({
      from: `MAILCOIN <${FROM_EMAIL}>`,
      to: email,
      subject: 'Missed Bitcoin? Buy $MAIL Now!',
      html: emailTemplate
    });
    
    if (error) {
      console.error('Resend API error:', error);
      throw new Error(error.message);
    }
    
    console.log('Email sent successfully:', data.id);
    
    res.json({
      success: true,
      message: `Test email sent to ${email}`,
      emailId: data.id
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    
    // Format error message for client
    let errorMessage = error.message || 'Failed to send email';
    if (errorMessage.includes('verify a domain')) {
      errorMessage = `Free Resend tier limitation: ${errorMessage}`;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Info endpoint for resend limitations
app.get('/api/email-info', (req, res) => {
  res.json({
    provider: 'Resend.com',
    limitations: 'Free tier can only send to your verified email address',
    verifiedEmail: VERIFIED_EMAIL,
    solution: 'To send to any email, verify a domain at resend.com/domains',
    docs: 'https://resend.com/docs/dashboard/domains/introduction'
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Using Resend.com with from address: ${FROM_EMAIL}`);
  console.log(`IMPORTANT: Free tier can only send to: ${VERIFIED_EMAIL}`);
});