#!/bin/bash

# Azure Deployment Script for Rocket-Cursor AI
# This script automates the deployment process described in AZURE_DEPLOYMENT_GUIDE.md

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 

# Configuration
RESOURCE_GROUP="rocket-cursor-rg"
LOCATION="eastus"
ACR_NAME="rocketcursoracr"
CONTAINER_ENV="rocket-cursor-env"
KEY_VAULT_NAME="rocket-cursor-kv"
REDIS_NAME="rocket-cursor-redis"
LOG_WORKSPACE="rocket-cursor-logs"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Azure CLI is installed
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Create Azure resources
create_infrastructure() {
    print_status "Creating Azure infrastructure..."
    
    # Create resource group
    print_status "Creating resource group: $RESOURCE_GROUP"
    az group create --name $RESOURCE_GROUP --location $LOCATION --output none
    
    # Create Azure Container Registry
    print_status "Creating Azure Container Registry: $ACR_NAME"
    az acr create \
        --resource-group $RESOURCE_GROUP \
        --name $ACR_NAME \
        --sku Standard \
        --admin-enabled true \
        --output none
    
    # Create Log Analytics workspace
    print_status "Creating Log Analytics workspace: $LOG_WORKSPACE"
    az monitor log-analytics workspace create \
        --resource-group $RESOURCE_GROUP \
        --workspace-name $LOG_WORKSPACE \
        --location $LOCATION \
        --output none
    
    # Get workspace credentials
    WORKSPACE_ID=$(az monitor log-analytics workspace show \
        --resource-group $RESOURCE_GROUP \
        --workspace-name $LOG_WORKSPACE \
        --query customerId -o tsv)
    
    WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
        --resource-group $RESOURCE_GROUP \
        --workspace-name $LOG_WORKSPACE \
        --query primarySharedKey -o tsv)
    
    # Create Container Apps environment
    print_status "Creating Container Apps environment: $CONTAINER_ENV"
    az containerapp env create \
        --name $CONTAINER_ENV \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --logs-workspace-id $WORKSPACE_ID \
        --logs-workspace-key $WORKSPACE_KEY \
        --output none
    
    # Create Redis Cache
    print_status "Creating Redis Cache: $REDIS_NAME"
    az redis create \
        --location $LOCATION \
        --name $REDIS_NAME \
        --resource-group $RESOURCE_GROUP \
        --sku Standard \
        --vm-size c1 \
        --output none
    
    # Create Key Vault
    print_status "Creating Key Vault: $KEY_VAULT_NAME"
    az keyvault create \
        --name $KEY_VAULT_NAME \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --output none
    
    print_success "Infrastructure created successfully"
}

# Store secrets in Key Vault
store_secrets() {
    print_status "Storing secrets in Key Vault..."
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create it with your environment variables."
        exit 1
    fi
    
    # Source environment variables
    set -a
    source .env
    set +a
    
    # Store secrets
    if [ ! -z "$OPENAI_API_KEY" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "OPENAI-API-KEY" --value "$OPENAI_API_KEY" --output none
    fi
    
    if [ ! -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "SUPABASE-URL" --value "$NEXT_PUBLIC_SUPABASE_URL" --output none
    fi
    
    if [ ! -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "SUPABASE-ANON-KEY" --value "$NEXT_PUBLIC_SUPABASE_ANON_KEY" --output none
    fi
    
    if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "SUPABASE-SERVICE-KEY" --value "$SUPABASE_SERVICE_ROLE_KEY" --output none
    fi
    
    if [ ! -z "$NEXT_PUBLIC_OPENWEATHER_API_KEY" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "OPENWEATHER-API-KEY" --value "$NEXT_PUBLIC_OPENWEATHER_API_KEY" --output none
    fi
    
    if [ ! -z "$WEATHERAPI_KEY" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "WEATHERAPI-KEY" --value "$WEATHERAPI_KEY" --output none
    fi
    
    if [ ! -z "$NEXT_PUBLIC_NOAA_API_KEY" ]; then
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "NOAA-API-KEY" --value "$NEXT_PUBLIC_NOAA_API_KEY" --output none
    fi
    
    # Get Redis connection details
    REDIS_KEY=$(az redis list-keys --name $REDIS_NAME --resource-group $RESOURCE_GROUP --query primaryKey -o tsv)
    REDIS_URL="$REDIS_NAME.redis.cache.windows.net:6380"
    
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "REDIS-URL" --value "$REDIS_URL" --output none
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "REDIS-TOKEN" --value "$REDIS_KEY" --output none
    
    print_success "Secrets stored successfully"
}

# Build and push Docker images
build_and_push_images() {
    print_status "Building and pushing Docker images..."
    
    # Login to ACR
    az acr login --name $ACR_NAME
    
    # Get ACR login server
    ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
    
    # Build and push frontend
    print_status "Building frontend image..."
    docker build -t $ACR_LOGIN_SERVER/rocket-web:latest . --platform linux/amd64
    docker push $ACR_LOGIN_SERVER/rocket-web:latest
    
    # Build and push agentpy service
    print_status "Building agentpy service image..."
    docker build -t $ACR_LOGIN_SERVER/rocket-agentpy:latest ./services/agentpy --platform linux/amd64
    docker push $ACR_LOGIN_SERVER/rocket-agentpy:latest
    
    # Build and push rocketpy service
    print_status "Building rocketpy service image..."
    docker build -t $ACR_LOGIN_SERVER/rocket-rocketpy:latest ./services/rocketpy --platform linux/amd64
    docker push $ACR_LOGIN_SERVER/rocket-rocketpy:latest
    
    print_success "Images built and pushed successfully"
}

# Deploy container apps
deploy_container_apps() {
    print_status "Deploying container apps..."
    
    ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
    ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
    
    # Deploy RocketPy service
    print_status "Deploying RocketPy service..."
    az containerapp create \
        --name rocket-rocketpy \
        --resource-group $RESOURCE_GROUP \
        --environment $CONTAINER_ENV \
        --image $ACR_LOGIN_SERVER/rocket-rocketpy:latest \
        --target-port 8000 \
        --ingress internal \
        --registry-server $ACR_LOGIN_SERVER \
        --registry-username $ACR_USERNAME \
        --registry-password $ACR_PASSWORD \
        --cpu 1.0 \
        --memory 2Gi \
        --min-replicas 1 \
        --max-replicas 3 \
        --env-vars PYTHONPATH=/app PYTHONUNBUFFERED=1 \
        --output none
    
    # Deploy AgentPy service
    print_status "Deploying AgentPy service..."
    az containerapp create \
        --name rocket-agentpy \
        --resource-group $RESOURCE_GROUP \
        --environment $CONTAINER_ENV \
        --image $ACR_LOGIN_SERVER/rocket-agentpy:latest \
        --target-port 8002 \
        --ingress internal \
        --registry-server $ACR_LOGIN_SERVER \
        --registry-username $ACR_USERNAME \
        --registry-password $ACR_PASSWORD \
        --cpu 0.5 \
        --memory 1Gi \
        --min-replicas 1 \
        --max-replicas 5 \
        --env-vars PYTHONPATH=/app PYTHONUNBUFFERED=1 \
        --secrets openai-api-key=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/OPENAI-API-KEY \
        --env-vars OPENAI_API_KEY=secretref:openai-api-key \
        --output none
    
    # Wait for backend services to be ready
    print_status "Waiting for backend services to be ready..."
    sleep 30
    
    # Get internal URLs for backend services
    AGENTPY_URL=$(az containerapp show --name rocket-agentpy --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
    ROCKETPY_URL=$(az containerapp show --name rocket-rocketpy --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
    
    # Deploy Web frontend
    print_status "Deploying Web frontend..."
    az containerapp create \
        --name rocket-web \
        --resource-group $RESOURCE_GROUP \
        --environment $CONTAINER_ENV \
        --image $ACR_LOGIN_SERVER/rocket-web:latest \
        --target-port 3000 \
        --ingress external \
        --registry-server $ACR_LOGIN_SERVER \
        --registry-username $ACR_USERNAME \
        --registry-password $ACR_PASSWORD \
        --cpu 0.5 \
        --memory 1Gi \
        --min-replicas 1 \
        --max-replicas 10 \
        --env-vars NODE_ENV=production AGENT_URL=https://$AGENTPY_URL ROCKETPY_URL=https://$ROCKETPY_URL \
        --secrets \
            supabase-url=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/SUPABASE-URL \
            supabase-anon-key=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/SUPABASE-ANON-KEY \
            supabase-service-key=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/SUPABASE-SERVICE-KEY \
            openweather-key=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/OPENWEATHER-API-KEY \
            weather-api-key=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/WEATHERAPI-KEY \
            noaa-key=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/NOAA-API-KEY \
            redis-url=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/REDIS-URL \
            redis-token=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/REDIS-TOKEN \
        --env-vars \
            NEXT_PUBLIC_SUPABASE_URL=secretref:supabase-url \
            NEXT_PUBLIC_SUPABASE_ANON_KEY=secretref:supabase-anon-key \
            SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-key \
            NEXT_PUBLIC_OPENWEATHER_API_KEY=secretref:openweather-key \
            WEATHERAPI_KEY=secretref:weather-api-key \
            NEXT_PUBLIC_NOAA_API_KEY=secretref:noaa-key \
            UPSTASH_REDIS_REST_URL=secretref:redis-url \
            UPSTASH_REDIS_REST_TOKEN=secretref:redis-token \
        --output none
    
    print_success "Container apps deployed successfully"
}

# Setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create Application Insights
    az monitor app-insights component create \
        --app rocket-cursor-insights \
        --location $LOCATION \
        --resource-group $RESOURCE_GROUP \
        --application-type web \
        --output none
    
    # Get instrumentation key
    INSIGHTS_KEY=$(az monitor app-insights component show \
        --app rocket-cursor-insights \
        --resource-group $RESOURCE_GROUP \
        --query instrumentationKey -o tsv)
    
    # Update container apps with insights
    az containerapp update \
        --name rocket-web \
        --resource-group $RESOURCE_GROUP \
        --set-env-vars APPLICATIONINSIGHTS_INSTRUMENTATION_KEY=$INSIGHTS_KEY \
        --output none
    
    print_success "Monitoring setup completed"
}

# Get deployment information
get_deployment_info() {
    print_status "Getting deployment information..."
    
    # Get application URL
    WEB_URL=$(az containerapp show \
        --name rocket-web \
        --resource-group $RESOURCE_GROUP \
        --query properties.configuration.ingress.fqdn \
        -o tsv)
    
    echo ""
    print_success "🚀 Deployment completed successfully!"
    echo ""
    echo -e "${GREEN}Application URL:${NC} https://$WEB_URL"
    echo ""
    echo -e "${BLUE}Resource Group:${NC} $RESOURCE_GROUP"
    echo -e "${BLUE}Container Registry:${NC} $ACR_NAME"
    echo -e "${BLUE}Container Apps Environment:${NC} $CONTAINER_ENV"
    echo -e "${BLUE}Key Vault:${NC} $KEY_VAULT_NAME"
    echo -e "${BLUE}Redis Cache:${NC} $REDIS_NAME"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Test your application at: https://$WEB_URL"
    echo "2. Check logs: az containerapp logs show --name rocket-web --resource-group $RESOURCE_GROUP --follow"
    echo "3. Monitor with Application Insights in Azure Portal"
    echo "4. Set up GitHub Actions for CI/CD (see AZURE_DEPLOYMENT_GUIDE.md)"
    echo ""
}

# Main deployment flow
main() {
    echo "🚀 Starting Azure deployment for Rocket-Cursor AI..."
    echo ""
    
    # Parse command line arguments
    SKIP_INFRA=false
    SKIP_BUILD=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-infrastructure)
                SKIP_INFRA=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-infrastructure    Skip infrastructure creation"
                echo "  --skip-build             Skip Docker image building"
                echo "  -h, --help              Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    check_prerequisites
    
    if [ "$SKIP_INFRA" = false ]; then
        create_infrastructure
        store_secrets
    else
        print_warning "Skipping infrastructure creation"
    fi
    
    if [ "$SKIP_BUILD" = false ]; then
        build_and_push_images
    else
        print_warning "Skipping Docker image building"
    fi
    
    deploy_container_apps
    setup_monitoring
    get_deployment_info
}

# Run main function
main "$@" 
