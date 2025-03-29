# Deploying Discord Chatter on Vercel

This guide outlines the steps and considerations for deploying the Discord Chatter application on Vercel's serverless platform.

## Prerequisites

1. A Vercel account connected to your GitHub repository
2. A Neon database (or other PostgreSQL provider compatible with serverless)
3. Discord bot token with proper permissions
4. Mailjet API credentials for email functionality
5. OpenAI API key for analysis generation

## Environment Variables

The following environment variables must be configured in your Vercel project settings:

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `production` for deployed environments | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DISCORD_BOT_TOKEN` | Your Discord bot authentication token | Yes |
| `OPENAI_API_KEY` | API key for OpenAI services | Yes |
| `MAILJET_API_KEY` | Mailjet API key for email sending | Yes |
| `MAILJET_SECRET_KEY` | Mailjet API secret | Yes |
| `SENDER_EMAIL` | Email address used as sender for notifications | Yes |
| `CRON_SECRET` | Secret token to authenticate cron job requests | Recommended |

## Deployment Process

1. Push your code to GitHub (you've already done this)
2. Import your repository in the Vercel dashboard
3. Configure all environment variables listed above
4. Deploy the application

## Scheduled Auto-Analysis with GitHub Actions

Because Vercel's Hobby tier has limitations on cron job frequency (once per day maximum), we've implemented a GitHub Actions workflow to trigger the auto-analysis endpoint more frequently:

1. **GitHub Actions Workflow**: Located at `.github/workflows/trigger-analysis.yml`
2. **Schedule**: Configured to run hourly, but can be adjusted as needed
3. **Manual Triggering**: Can also be triggered manually through the GitHub Actions UI

### Required GitHub Repository Secrets

After deploying to Vercel, you'll need to add these secrets to your GitHub repository:

| Secret | Description | Example |
|--------|-------------|----------|
| `ANALYSIS_ENDPOINT` | Full URL to your auto-analysis endpoint | `https://your-app.vercel.app/api/cron/auto-analysis` |
| `CRON_SECRET` | Authentication token (matching the CRON_SECRET in Vercel env) | `your-secure-token` |

### Setting Up GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add the secrets listed above

## Serverless Considerations

Vercel's platform uses a serverless architecture, which differs from a traditional Express server in several ways:

### 1. No Persistent Connections

The traditional Express server maintains persistent connections to Discord and databases. In the serverless version:

- Discord connection is established per-request via API routes
- Database connections use the Neon serverless client designed for stateless functions

### 2. Cron Jobs via Vercel's Scheduler

Instead of using `node-schedule` running continuously, the auto-analysis is triggered via Vercel's built-in cron functionality, which calls the `/api/cron/auto-analysis` endpoint at regular intervals.

### 3. Cold Starts

Be aware that serverless functions have "cold starts" - the initial request after a period of inactivity may be slower as the environment spins up.

## Testing After Deployment

1. Try connecting your Discord bot via the UI
2. Check if messages are being displayed correctly
3. Update user settings to enable email notifications
4. Verify the auto-analysis process is working by sending messages to a Discord channel and checking if you receive the email

## Troubleshooting

### Common Issues and Solutions

#### 1. MIME Type Errors with ES Modules

**Issue**: Error message `Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "application/octet-stream"`

**Solution**: 
- Update Content-Type headers in vercel.json to use `text/javascript` instead of `application/javascript`
- Example configuration:
```json
{
  "headers": [
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Content-Type",
          "value": "text/javascript; charset=utf-8"
        }
      ]
    }
  ]
}
```

#### 2. 404 Errors with API Routes

**Issue**: API endpoints returning 404 Not Found errors

**Solutions**:
1. Verify API route structure:
   - Move API routes to the correct Vercel directory structure
   - API files should be in `/api` directory at project root, not in `/server/api`
2. Example path structure:
   - ❌ `/server/api/cron/auto-analysis.ts` (won't work)
   - ✅ `/api/cron/auto-analysis.ts` (correct location)

#### 3. URL Configuration Issues

**Issue**: Mismatch between GitHub Actions configuration and actual deployment URL

**Solution**:
1. Check the actual deployment URL in Vercel dashboard
2. Update GitHub repository secrets:
   - Update `ANALYSIS_ENDPOINT` to match the correct Vercel deployment URL
   - Format: `https://your-app.vercel.app/api/cron/auto-analysis`
3. Verify URL format:
   - Ensure correct spelling of 'vercel.app'
   - Include complete path to the endpoint

### General Troubleshooting Steps

1. Check Vercel function logs in the dashboard if functionality is not working as expected
2. Verify environment variables are correctly set
3. For Discord-related issues, ensure your bot is properly invited to the servers and has the necessary permissions
4. For database issues, confirm your Neon database connection string is correct and includes all required parameters

## Limitations

- Function timeout: Vercel functions have a maximum execution time, which may impact processing very large message histories
- Memory constraints: Be mindful of the 1024MB memory limit for serverless functions
- Statelessness: The application architecture has been adapted to be stateless, which may affect some real-time functionality
