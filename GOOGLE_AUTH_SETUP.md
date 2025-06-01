# Google OAuth Setup for ROCKETv1

This guide will help you set up Google OAuth authentication for your ROCKETv1 application using Supabase.

## Prerequisites

- A Supabase project
- A Google Cloud Platform account
- Admin access to your Supabase dashboard

## Step 1: Configure Google OAuth in Google Cloud Console

### 1.1 Create a Google Cloud Project (if you don't have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "ROCKETv1-Auth")
4. Click "Create"

### 1.2 Enable Google+ API

1. In your Google Cloud project, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 1.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Set the name (e.g., "ROCKETv1 Web Client")

### 1.4 Configure Authorized URLs

**Authorized JavaScript origins:**
```
http://localhost:3000
https://rqoxlcpbrdcbgrkrvzug.supabase.co
https://your-domain.com
```

**Authorized redirect URIs:**
```
https://rqoxlcpbrdcbgrkrvzug.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

⚠️ **Important:** Replace `your-supabase-project` with your actual Supabase project reference.

### 1.5 Save Your Credentials

After creating the OAuth client, you'll get:
- **Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)
- **Client Secret** (looks like: `GOCSPX-abc123def456`)

## Step 2: Configure Supabase

### 2.1 Navigate to Authentication Settings

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "Authentication" → "Settings"

### 2.2 Configure Google Provider

1. Scroll down to "Auth Providers"
2. Find "Google" and click the toggle to enable it
3. Enter your Google OAuth credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
4. Click "Save"

### 2.3 Configure Site URL

In the "General" tab of Authentication settings:
- **Site URL**: Set to your production domain (e.g., `https://your-domain.com`)
- **Redirect URLs**: Add your allowed redirect URLs:
  ```
  http://localhost:3000/**
  https://your-domain.com/**
  ```

## Step 3: Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (Optional - for client-side reference)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

## Step 4: Test the Setup

### 4.1 Run Your Application

```bash
npm run dev
```

### 4.2 Test Google Sign-In

1. Navigate to `http://localhost:3000/auth`
2. Click "Continue with Google"
3. You should be redirected to Google's OAuth consent screen
4. After authorization, you should be redirected back to your app

## Step 5: Production Deployment

### 5.1 Update Google Cloud Console

When deploying to production:

1. Add your production domain to "Authorized JavaScript origins"
2. Add your production callback URL to "Authorized redirect URIs"

### 5.2 Update Supabase Settings

1. Update the "Site URL" in Supabase Authentication settings
2. Add your production domain to "Redirect URLs"

## Troubleshooting

### Common Issues

**1. "Invalid redirect URI"**
- Check that your redirect URIs in Google Cloud Console match exactly
- Ensure you're using the correct Supabase project URL

**2. "OAuth consent screen not configured"**
- In Google Cloud Console, go to "OAuth consent screen"
- Configure the consent screen with your app details

**3. "Google provider not enabled"**
- Verify that Google is enabled in Supabase Authentication settings
- Check that your Client ID and Secret are correct

**4. "User not created in database"**
- Check your database policies allow user creation
- Verify the user initialization code in AuthContext.tsx

### Debug Information

To debug OAuth issues:

1. Check browser network tab for failed requests
2. Check Supabase logs in the dashboard
3. Verify environment variables are loaded correctly

## Security Notes

1. **Never commit your Client Secret** to version control
2. **Use environment variables** for all sensitive configuration
3. **Regularly rotate your OAuth credentials** for production apps
4. **Configure proper CORS settings** in both Google Cloud and Supabase
5. **Enable only necessary scopes** for Google OAuth

## Next Steps

After successful setup:

1. Customize the user onboarding flow
2. Set up user roles and permissions
3. Configure additional OAuth providers if needed
4. Implement proper error handling and logging

---

## Quick Test Checklist

- [ ] Google Cloud project created
- [ ] OAuth client ID created with correct redirect URIs
- [ ] Google provider enabled in Supabase
- [ ] Environment variables configured
- [ ] Local development working
- [ ] Production domains configured (if deploying)

For additional help, check the [Supabase Authentication documentation](https://supabase.com/docs/guides/auth/social-login/auth-google) or [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2). 