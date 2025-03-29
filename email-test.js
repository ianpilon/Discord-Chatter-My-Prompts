// Simple test script to verify the sender email configuration

async function testEmailSender() {
  try {
    console.log('Sending test email to verify sender email configuration...');
    
    // Make a request to the email API
    const response = await fetch('http://localhost:3000/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'ianpilon@gmail.com', // Replace with where you want to receive the test email
        subject: 'Sender Email Test',
        content: 'This is a test email to verify that the sender email configuration has been updated to ianpilon@ianpilon.com.',
        analysisType: 'test'
      }),
    });
    
    const result = await response.json();
    console.log('API Response:', result);
    
    if (result.success) {
      console.log('Test email sent successfully! Check your inbox.');
      console.log('If the email came from ianpilon@ianpilon.com, the configuration change worked!');
    } else {
      console.error('Failed to send test email:', result.message);
    }
  } catch (error) {
    console.error('Error making API request:', error);
  }
}

// Run the test
testEmailSender();
