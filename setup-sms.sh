#!/bin/bash

# Shuletech SMS System Setup Script
# This script configures the SMS system with Africa's Talking credentials

set -e

echo "🚀 Shuletech SMS System Setup"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if .env.local exists
echo "Step 1: Checking environment configuration..."
if [ -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local already exists${NC}"
else
    echo -e "${GREEN}✓ Creating .env.local${NC}"
    touch .env.local
fi

echo ""
echo "Step 2: Setting up Africa's Talking credentials..."
echo "=================================="
echo ""
echo "Please enter your Africa's Talking API credentials:"
echo ""

# Get API Key
read -p "Africa's Talking API Key: " API_KEY
if [ -z "$API_KEY" ]; then
    echo -e "${RED}❌ API Key cannot be empty${NC}"
    exit 1
fi

# Get Username
read -p "Africa's Talking Username (default: shuletech): " USERNAME
USERNAME=${USERNAME:-shuletech}

# Get Sender ID
read -p "Sender ID for SMS (default: SHULETECH): " SENDER_ID
SENDER_ID=${SENDER_ID:-SHULETECH}

echo ""
echo "Step 3: Updating .env.local..."
echo "=================================="

# Check if variables already exist and remove them
if grep -q "AFRICAS_TALKING_API_KEY" .env.local; then
    sed -i '' '/^AFRICAS_TALKING_API_KEY=/d' .env.local
fi
if grep -q "AFRICAS_TALKING_USERNAME" .env.local; then
    sed -i '' '/^AFRICAS_TALKING_USERNAME=/d' .env.local
fi
if grep -q "AFRICAS_TALKING_SENDER_ID" .env.local; then
    sed -i '' '/^AFRICAS_TALKING_SENDER_ID=/d' .env.local
fi

# Add new variables
echo "AFRICAS_TALKING_API_KEY=$API_KEY" >> .env.local
echo "AFRICAS_TALKING_USERNAME=$USERNAME" >> .env.local
echo "AFRICAS_TALKING_SENDER_ID=$SENDER_ID" >> .env.local

echo -e "${GREEN}✓ Environment variables updated${NC}"
echo ""

# Step 4: Install dependencies
echo "Step 4: Installing dependencies..."
echo "=================================="

if command -v npm &> /dev/null; then
    echo "Installing npm packages..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
elif command -v yarn &> /dev/null; then
    echo "Installing yarn packages..."
    yarn install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
elif command -v pnpm &> /dev/null; then
    echo "Installing pnpm packages..."
    pnpm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}❌ No package manager found (npm, yarn, or pnpm required)${NC}"
    exit 1
fi

echo ""
echo "Step 5: Verifying configuration..."
echo "=================================="

# Verify variables are set
if grep -q "AFRICAS_TALKING_API_KEY=$API_KEY" .env.local; then
    echo -e "${GREEN}✓ API Key configured${NC}"
else
    echo -e "${RED}❌ API Key configuration failed${NC}"
    exit 1
fi

if grep -q "AFRICAS_TALKING_USERNAME=$USERNAME" .env.local; then
    echo -e "${GREEN}✓ Username configured${NC}"
else
    echo -e "${RED}❌ Username configuration failed${NC}"
    exit 1
fi

if grep -q "AFRICAS_TALKING_SENDER_ID=$SENDER_ID" .env.local; then
    echo -e "${GREEN}✓ Sender ID configured${NC}"
else
    echo -e "${RED}❌ Sender ID configuration failed${NC}"
    exit 1
fi

echo ""
echo "Step 6: Next Steps"
echo "=================================="
echo ""
echo -e "${GREEN}✅ SMS System Setup Complete!${NC}"
echo ""
echo "📝 Configuration Summary:"
echo "   • API Key: ${API_KEY:0:20}...${API_KEY: -10}"
echo "   • Username: $USERNAME"
echo "   • Sender ID: $SENDER_ID"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. If you're deploying to Vercel, add these environment variables:"
echo "   • AFRICAS_TALKING_API_KEY=$API_KEY"
echo "   • AFRICAS_TALKING_USERNAME=$USERNAME"
echo "   • AFRICAS_TALKING_SENDER_ID=$SENDER_ID"
echo ""
echo "2. Run your development server:"
echo "   npm run dev"
echo ""
echo "3. Access the SMS Management:"
echo "   • Super Admin: http://localhost:3000/super-admin/sms-management"
echo "   • Password: shuletech"
echo ""
echo "4. Test the integration:"
echo "   • Check Africa's Talking balance displays"
echo "   • Buy SMS from Super Admin"
echo "   • Enable SMS for schools"
echo ""
echo "📚 For more help, see: docs/SMS_PRODUCTION_SETUP.md"
echo ""
echo -e "${GREEN}Happy testing! 🎉${NC}"
