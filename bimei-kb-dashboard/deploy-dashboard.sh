#!/bin/bash
# deploy-dashboard.sh - Deploy BIMei KB Dashboard to Google Cloud Storage

# Configuration
BUCKET_NAME="bimei-kb-dashboard"
PROJECT_ID="bimei-ai"
DOMAIN_WHITELIST="bimexcellence.org,yourdomain.com"

# Create bucket (if not exists)
gsutil mb -p $PROJECT_ID gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"

# Upload dashboard file
gsutil cp B_Dashboard_WordPress.html gs://$BUCKET_NAME/index.html

# Set public read access
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

# Configure CORS for iframe embedding
cat > cors.json << EOF
[
  {
    "origin": ["https://bimexcellence.org", "https://*.bimexcellence.org"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "X-Frame-Options"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://$BUCKET_NAME

# Enable website hosting
gsutil web set -m index.html -e 404.html gs://$BUCKET_NAME

echo "Dashboard deployed to: https://storage.googleapis.com/$BUCKET_NAME/index.html"
echo "Custom domain: https://$BUCKET_NAME.storage.googleapis.com"