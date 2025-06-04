# Azure Container Apps Deployment Guide
## ROCKETv1 Production Deployment Process

---

## 🎯 **Overview**

This guide covers the complete process for deploying ROCKETv1 to Azure Container Apps, including initial setup, container updates, and troubleshooting.

### **Architecture**
- **Frontend**: Next.js 14 app with 3D visualization
- **AI Agent**: Python service with OpenAI Agents SDK  
- **Physics Engine**: RocketPy simulation service
- **Database**: Supabase (external)
- **Registry**: Azure Container Registry (ACR)
- **Hosting**: Azure Container Apps

---

## 📋 **Prerequisites**

### **Required Tools**
```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Docker
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Verify installations
az --version
docker --version
docker-compose --version
```

### **Azure Login**
```bash
az login
az account set --subscription "your-subscription-id"
```

### **Environment Variables**
Ensure these are set in your `.env`:
```bash
# Required for all services
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Azure-specific
AZURE_SUBSCRIPTION_ID=...
AZURE_RESOURCE_GROUP=rocket-cursor-rg
AZURE_REGISTRY=rocketcursoracr
```

---

## 🏗️ **Initial Infrastructure Setup**

### **1. Resource Group Creation**
```bash
az group create \
  --name rocket-cursor-rg \
  --location eastus
```

### **2. Container Registry Setup**
```bash
# Create ACR
az acr create \
  --resource-group rocket-cursor-rg \
  --name rocketcursoracr \
  --sku Basic \
  --admin-enabled true

# Login to ACR
az acr login --name rocketcursoracr
```

### **3. Container Apps Environment**
```bash
# Create Container Apps environment
az containerapp env create \
  --name rocket-env \
  --resource-group rocket-cursor-rg \
  --location eastus
```

---

## 🚀 **Deployment Process**

### **Method 1: Using Deployment Script (Recommended)**

#### **Full Deployment**
```bash
# Initial deployment with infrastructure
./scripts/deploy-azure.sh
```

#### **Update Existing Containers**
```bash
# Skip infrastructure creation, just update containers
./scripts/deploy-azure.sh --skip-infrastructure
```

### **Method 2: Manual Step-by-Step**

#### **1. Build and Push Images**
```bash
# Build all services locally
docker-compose build

# Tag images for ACR
docker tag rocketv1-web:latest rocketcursoracr.azurecr.io/rocket-web:latest
docker tag rocketv1-agentpy:latest rocketcursoracr.azurecr.io/rocket-agentpy:latest  
docker tag rocketv1-rocketpy:latest rocketcursoracr.azurecr.io/rocket-rocketpy:latest

# Push to ACR
docker push rocketcursoracr.azurecr.io/rocket-web:latest
docker push rocketcursoracr.azurecr.io/rocket-agentpy:latest
docker push rocketcursoracr.azurecr.io/rocket-rocketpy:latest
```

#### **2. Deploy Container Apps**

**Frontend (Web)**
```bash
az containerapp create \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --environment rocket-env \
  --image rocketcursoracr.azurecr.io/rocket-web:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server rocketcursoracr.azurecr.io \
  --registry-username rocketcursoracr \
  --registry-password $(az acr credential show --name rocketcursoracr --query passwords[0].value -o tsv) \
  --env-vars \
    OPENAI_API_KEY="$OPENAI_API_KEY" \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
    AGENT_URL="http://rocket-agentpy" \
    ROCKETPY_URL="http://rocket-rocketpy:8000"
```

**AI Agent (AgentPy)**
```bash
az containerapp create \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --environment rocket-env \
  --image rocketcursoracr.azurecr.io/rocket-agentpy:latest \
  --target-port 8002 \
  --ingress internal \
  --registry-server rocketcursoracr.azurecr.io \
  --registry-username rocketcursoracr \
  --registry-password $(az acr credential show --name rocketcursoracr --query passwords[0].value -o tsv) \
  --env-vars \
    OPENAI_API_KEY="$OPENAI_API_KEY"
```

**Physics Engine (RocketPy)**
```bash
az containerapp create \
  --name rocket-rocketpy \
  --resource-group rocket-cursor-rg \
  --environment rocket-env \
  --image rocketcursoracr.azurecr.io/rocket-rocketpy:latest \
  --target-port 8000 \
  --ingress internal \
  --registry-server rocketcursoracr.azurecr.io \
  --registry-username rocketcursoracr \
  --registry-password $(az acr credential show --name rocketcursoracr --query passwords[0].value -o tsv)
```

---

## 🔄 **Updating Existing Deployments**

### **Update Individual Services**
```bash
# Update web frontend
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --image rocketcursoracr.azurecr.io/rocket-web:latest

# Update AI agent
az containerapp update \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --image rocketcursoracr.azurecr.io/rocket-agentpy:latest

# Update physics engine
az containerapp update \
  --name rocket-rocketpy \
  --resource-group rocket-cursor-rg \
  --image rocketcursoracr.azurecr.io/rocket-rocketpy:latest
```

### **Batch Update with Script**
```bash
# Build new images and update all services
./scripts/deploy-azure.sh --skip-infrastructure
```

---

## 📊 **Monitoring & Verification**

### **Check Deployment Status**
```bash
# List all container apps
az containerapp list \
  --resource-group rocket-cursor-rg \
  --query "[].{Name:name, Status:properties.runningStatus, URL:properties.configuration.ingress.fqdn}" \
  --output table
```

### **Get Application URL**
```bash
# Get the public URL for the web frontend
az containerapp show \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

### **View Logs**
```bash
# View real-time logs for any service
az containerapp logs show \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --follow

# View logs for AI agent
az containerapp logs show \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --follow

# View logs for physics engine  
az containerapp logs show \
  --name rocket-rocketpy \
  --resource-group rocket-cursor-rg \
  --follow
```

### **Health Checks**
```bash
# Check individual service health
curl -s https://rocket-web.yellowhill-85e5bd96.eastus.azurecontainerapps.io/api/health
curl -s http://rocket-agentpy/health  # Internal URL
curl -s http://rocket-rocketpy:8000/health  # Internal URL
```

---

## 🔧 **Configuration Management**

### **Environment Variables**
```bash
# Update environment variables for a service
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --set-env-vars \
    OPENAI_API_KEY="new-key" \
    DEBUG_MODE="true"
```

### **Scaling Configuration**
```bash
# Configure auto-scaling
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --min-replicas 1 \
  --max-replicas 5
```

### **Resource Limits**
```bash
# Set CPU and memory limits
az containerapp update \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --cpu 1.0 \
  --memory 2.0Gi
```

---

## 🐛 **Troubleshooting**

### **Common Issues**

#### **1. Container App Won't Start**
```bash
# Check recent logs
az containerapp logs show \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --tail 100

# Check container app revision status
az containerapp revision list \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --output table
```

#### **2. Image Pull Errors**
```bash
# Verify ACR credentials
az acr credential show --name rocketcursoracr

# Test image exists
az acr repository show --name rocketcursoracr --image rocket-web:latest
```

#### **3. Service Communication Issues**
```bash
# Check internal DNS resolution
az containerapp exec \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --command "nslookup rocket-agentpy"
```

#### **4. Environment Variable Issues**
```bash
# List current environment variables
az containerapp show \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --query properties.template.containers[0].env
```

### **Recovery Procedures**

#### **Rollback to Previous Revision**
```bash
# List revisions
az containerapp revision list \
  --name rocket-web \
  --resource-group rocket-cursor-rg

# Activate previous revision
az containerapp revision activate \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --revision rocket-web--previous-revision-name
```

#### **Force Restart**
```bash
# Restart a container app
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --image rocketcursoracr.azurecr.io/rocket-web:latest
```

---

## 🔐 **Security Considerations**

### **Registry Security**
```bash
# Use managed identity instead of admin credentials
az containerapp identity assign \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --system-assigned

# Grant ACR pull permissions
az role assignment create \
  --assignee $(az containerapp show --name rocket-web --resource-group rocket-cursor-rg --query identity.principalId -o tsv) \
  --role AcrPull \
  --scope $(az acr show --name rocketcursoracr --resource-group rocket-cursor-rg --query id -o tsv)
```

### **Network Security**
```bash
# Restrict ingress to specific IPs (if needed)
az containerapp ingress update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --allow-insecure false
```

### **Environment Variables Security**
```bash
# Use Key Vault for sensitive values
az keyvault create \
  --name rocket-vault \
  --resource-group rocket-cursor-rg \
  --location eastus

# Store secrets
az keyvault secret set \
  --vault-name rocket-vault \
  --name openai-api-key \
  --value "$OPENAI_API_KEY"
```

---

## 📊 **Performance Optimization**

### **Resource Sizing Guidelines**

| Service | CPU | Memory | Replicas | Use Case |
|---------|-----|--------|----------|----------|
| **rocket-web** | 0.5 | 1.0Gi | 1-3 | Frontend serving |
| **rocket-agentpy** | 1.0 | 2.0Gi | 1-2 | AI processing |
| **rocket-rocketpy** | 1.0 | 1.5Gi | 1-2 | Physics simulation |

### **Scaling Configuration**
```bash
# Configure auto-scaling for web frontend
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --min-replicas 1 \
  --max-replicas 5 \
  --scale-rule-name http-requests \
  --scale-rule-type http \
  --scale-rule-metadata concurrentRequests=50

# Configure CPU-based scaling for AI agent
az containerapp update \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --min-replicas 1 \
  --max-replicas 3 \
  --scale-rule-name cpu-usage \
  --scale-rule-type cpu \
  --scale-rule-metadata targetCPUUtilization=70
```

---

## 🔄 **CI/CD Integration**

### **GitHub Actions Example**
```yaml
# .github/workflows/azure-deploy.yml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Azure Login
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    
    - name: Build and Deploy
      run: |
        ./scripts/deploy-azure.sh --skip-infrastructure
```

### **Azure DevOps Pipeline**
```yaml
# azure-pipelines.yml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: AzureCLI@2
  displayName: 'Deploy to Container Apps'
  inputs:
    azureSubscription: 'Azure-Service-Connection'
    scriptType: 'bash'
    scriptLocation: 'scriptPath'
    scriptPath: './scripts/deploy-azure.sh'
    arguments: '--skip-infrastructure'
```

---

## 📋 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Environment variables configured
- [ ] Docker images built successfully
- [ ] Local testing completed
- [ ] Database migrations applied
- [ ] Azure CLI authenticated

### **Deployment**
- [ ] Images pushed to ACR
- [ ] Container apps created/updated
- [ ] Health checks passing
- [ ] Environment variables set
- [ ] Ingress configured correctly

### **Post-Deployment**
- [ ] Application URL accessible
- [ ] All services responding
- [ ] Database connectivity verified
- [ ] AI agent functionality tested
- [ ] Physics simulations working
- [ ] Logs showing no errors

### **Monitoring Setup**
- [ ] Log streaming configured
- [ ] Health monitoring enabled
- [ ] Performance metrics tracking
- [ ] Alert rules configured

---

## 🎯 **Current Production Status**

### **Live Deployment**
- **Frontend URL**: https://rocket-web.yellowhill-85e5bd96.eastus.azurecontainerapps.io
- **Resource Group**: rocket-cursor-rg
- **Region**: East US
- **Status**: ✅ All services running

### **Service Versions**
| Service | Revision | Status | Image |
|---------|----------|--------|--------|
| rocket-web | 0000009 | Running | rocket-web:latest |
| rocket-agentpy | 0000002 | Running | rocket-agentpy:latest |
| rocket-rocketpy | 3q1oq72 | Running | rocket-rocketpy:latest |

---
