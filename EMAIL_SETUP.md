# Email Setup Instructions

## Gmail App Password Setup

To enable email notifications for contact form submissions, you need to set up a Gmail App Password:

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to "Security" → "2-Step Verification"
3. Follow the steps to enable 2-factor authentication if not already enabled

### Step 2: Generate App Password
1. Go to "Security" → "2-Step Verification" → "App passwords"
2. Select "Mail" as the app and "Other" as the device
3. Enter "Ndola Homes Website" as the device name
4. Click "Generate"
5. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

### Step 3: Update .env File
1. Open the `.env` file in your project root
2. Replace `your_gmail_app_password_here` with the app password you generated:
   ```
   EMAIL_PASS=abcd efgh ijkl mnop
   ```
3. Save the file

### Step 4: Restart Server
After updating the .env file, restart your server:
```bash
npm run dev
```

## Email Configuration

The email system is configured to:
- Send emails TO: misheckmwamba99@gmail.com
- Send emails FROM: misheckmwamba99@gmail.com
- Use Gmail SMTP servers
- Include visitor's email as reply-to address

## Testing

Once configured, test the email functionality by:
1. Going to your website
2. Filling out the contact form
3. Submitting the form
4. Check your Gmail inbox for the notification

## Troubleshooting

If emails aren't being sent:
1. Check the server console for error messages
2. Verify the app password is correct (no spaces)
3. Ensure 2-factor authentication is enabled on your Gmail account
4. Check your Gmail spam folder

## Email Template

Contact form emails will include:
- Visitor's name and email
- Phone number (if provided)
- Message content
- Property ID (if inquiry is about a specific listing)
- Reply-to set to visitor's email for easy responses
