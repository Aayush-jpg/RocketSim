#!/bin/bash
# Setup environment file for Azure deployment

echo "Creating .env file with your configuration..."

cat > .env << 'EOF'
OPENAI_API_KEY=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
AGENT_URL=http://agentpy:8002
ROCKETPY_URL=http://rocketpy:8000
NEXT_PUBLIC_OPENWEATHER_API_KEY=908588d7f8b034ea06bf47292bc02a71
WEATHERAPI_KEY=cca965ee14a84185aa954315252605
NEXT_PUBLIC_TIMEZONE_API_KEY=4ES41L32N4CE
NEXT_PUBLIC_NOAA_API_KEY=MefsECNkWVRvTgnbOKqidjYkCcSUuNcc
NEXT_PUBLIC_SUPABASE_URL=https://rqoxlcpbrdcbgrkrvzug.supabase.co 
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb3hsY3BicmRjYmdya3J2enVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3OTAzMjYsImV4cCI6MjA2NDM2NjMyNn0.MbA7QwYQrLC-BSoC83P83jdM1v0NN5_NZLG3R-pMoHM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb3hsY3BicmRjYmdya3J2enVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODc5MDMyNiwiZXhwIjoyMDY0MzY2MzI2fQ.Focb33i6RvHqxnp1I3T168E95ZI1SVOBdHCwTnYLVVM
NEXT_PUBLIC_GOOGLE_CLIENT_ID=711116926140-k865sukndun1tl29bkkuosg84hlr2hq1.apps.googleusercontent.com
EOF

echo "✅ Environment file created successfully!"
echo "📁 Created: .env"
echo ""
echo "Next steps:"
echo "1. Install Azure CLI: brew install azure-cli"
echo "2. Login to Azure: az login"
echo "3. Run deployment: ./scripts/deploy-azure.sh" 
