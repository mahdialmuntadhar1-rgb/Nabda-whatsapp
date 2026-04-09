#!/bin/bash

# NABDA WhatsApp v2.0 - DEPLOYMENT SCRIPT
# Run this to deploy to production

echo "🚀 NABDA v2.0 Deployment Script"
echo "================================"
echo ""

# Step 1: Verify files exist
echo "✅ Verifying code changes..."
files=(
  "server.ts"
  "src/components/CampaignView.tsx"
  "src/components/TemplateEditor.tsx"
  "src/lib/gemini-helper.ts"
  "src/components/TemplateABTest.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file MISSING!"
    exit 1
  fi
done

echo ""
echo "✅ All code files present!"
echo ""

# Step 2: Check git status
echo "📦 Git status:"
git status --short | head -10
echo ""

# Step 3: Instructions
echo "🎯 To deploy:"
echo ""
echo "1. Verify environment variables in .env file:"
echo "   - NABDA_API_TOKEN"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "2. Commit and push:"
echo "   git add ."
echo "   git commit -m 'Deploy: Nabda v2.0'"
echo "   git push origin main"
echo ""
echo "3. Add to Vercel Environment Variables:"
echo "   - All 8 variables from .env"
echo ""
echo "4. Vercel will auto-deploy!"
echo ""
echo "✨ Ready to deploy!"
