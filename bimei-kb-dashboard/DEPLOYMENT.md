# BIMei KB Dashboard - Deployment Guide

Complete deployment instructions for the BIMei Knowledge Dashboard.

---

## Prerequisites

### Required Tools
- **Google Cloud SDK**: [Install](https://cloud.google.com/sdk/docs/install)
- **Node.js 20+**: For local testing
- **Git**: For version control

### Google Cloud Access
```bash
# Authenticate with Google Cloud
gcloud auth login

# Set project
gcloud config set project bimei-ai

# Verify access
gcloud projects describe bimei-ai
```

---

## Environment Configuration

### Create .env.yaml

Create a `.env.yaml` file in the `bimei-kb-dashboard` directory with the following variables:

```yaml
NEO4J_URI: "neo4j+s://4441767a.databases.neo4j.io"
NEO4J_USER: "neo4j"
NEO4J_PASSWORD: "***REMOVED***"
GOOGLE_API_KEY: "***REMOVED***"
GOOGLE_GENAI_API_KEY: "***REMOVED***"
VERTEX_PROXY_URL: "https://bimei-chatbot-jilezw5qqq-ts.a.run.app"
GRAPH_QUERY_URL: "https://graphquery-jilezw5qqq-uc.a.run.app"
```

**Important**: Never commit `.env.yaml` to git. It's already in `.gitignore`.

---

## Deployment Steps

### 1. Deploy Backend (Cloud Function)

```bash
cd /Users/bilalsuccar/Documents/microtools/bimei-kb-dashboard

# Deploy the Cloud Function
gcloud functions deploy dashboardApi \
  --gen2 \
  --runtime=nodejs20 \
  --region=australia-southeast1 \
  --source=. \
  --entry-point=dashboardApi \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars NEO4J_URI="neo4j+s://4441767a.databases.neo4j.io",NEO4J_USER="neo4j",NEO4J_PASSWORD="***REMOVED***",GOOGLE_API_KEY="***REMOVED***",GOOGLE_GENAI_API_KEY="***REMOVED***"
```

**Deployment Time**: ~2-3 minutes

**Verify Deployment**:
```bash
# Get function URL
gcloud functions describe dashboardApi \
  --gen2 \
  --region=australia-southeast1 \
  --format="value(serviceConfig.uri)"

# Test function
curl -X POST https://dashboardapi-jilezw5qqq-ts.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"query":"What is BIM?"}'
```

### 2. Deploy Frontend (GCS)

```bash
# Upload HTML to Google Cloud Storage
gsutil cp B_Dashboard_UI.html gs://bimei-kb-dashboard/index.html

# Disable caching for immediate updates
gsutil setmeta -h "Cache-Control:no-cache, max-age=0" gs://bimei-kb-dashboard/index.html

# Verify upload
gsutil ls -L gs://bimei-kb-dashboard/index.html
```

**Access Dashboard**: <https://storage.googleapis.com/bimei-kb-dashboard/index.html>

### 3. Update Version Number

Before deployment, update the version in `B_Dashboard_UI.html`:

```html
<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">v1.0.X</span>
```

Increment by 0.1 for each deployment with user-visible changes.

---

## Quick Deployment Script

Use the provided deployment script for faster deployments:

```bash
# Make script executable (first time only)
chmod +x deploy-dashboard.sh

# Deploy frontend only
./deploy-dashboard.sh
```

**Note**: The script currently uploads `B_Dashboard_WordPress.html`. Update it to use `B_Dashboard_UI.html`:

```bash
# Edit deploy-dashboard.sh
# Change line 13 from:
gsutil cp B_Dashboard_WordPress.html gs://$BUCKET_NAME/index.html
# To:
gsutil cp B_Dashboard_UI.html gs://$BUCKET_NAME/index.html
```

---

## Updating Deployed Function

### Update Environment Variables Only

If you only need to update environment variables (e.g., Neo4j password):

```bash
# Update via gcloud
gcloud functions deploy dashboardApi \
  --gen2 \
  --runtime=nodejs20 \
  --region=australia-southeast1 \
  --source=. \
  --entry-point=dashboardApi \
  --trigger-http \
  --allow-unauthenticated \
  --update-env-vars NEO4J_PASSWORD="new-password-here"
```

**Or via Console**:
1. Go to [Cloud Functions Console](https://console.cloud.google.com/functions)
2. Click on `dashboardApi`
3. Click "Edit"
4. Update environment variables
5. Deploy

### Update Code Only

If code changes but environment variables are unchanged:

```bash
# Deploy with existing env vars
gcloud functions deploy dashboardApi \
  --gen2 \
  --runtime=nodejs20 \
  --region=australia-southeast1 \
  --source=. \
  --entry-point=dashboardApi \
  --trigger-http \
  --allow-unauthenticated
```

---

## Monitoring & Logs

### View Function Logs

```bash
# Real-time logs
gcloud functions logs tail dashboardApi \
  --gen2 \
  --region=australia-southeast1

# Recent logs
gcloud functions logs read dashboardApi \
  --gen2 \
  --region=australia-southeast1 \
  --limit=50

# Filter for errors
gcloud functions logs read dashboardApi \
  --gen2 \
  --region=australia-southeast1 \
  --limit=100 | grep -i error
```

### Cloud Console Monitoring

1. Visit [Cloud Functions Dashboard](https://console.cloud.google.com/functions/details/australia-southeast1/dashboardApi?project=bimei-ai)
2. Click "Logs" tab for detailed execution logs
3. Click "Metrics" tab for performance data

---

## Testing Deployments

### Test Backend API

```bash
# Test text module
curl -X POST https://dashboardapi-jilezw5qqq-ts.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"query":"What is BIM?","modules":["text","sources"]}'

# Test graph module
curl -X POST https://dashboardapi-jilezw5qqq-ts.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the relationship between BIM and COBie?"}'

# Test all modules
curl -X POST https://dashboardapi-jilezw5qqq-ts.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"query":"How does process maturity relate to adaptive capacity?","modules":["text","sources","evidence","path","graph"]}'
```

### Test Frontend

1. Open <https://storage.googleapis.com/bimei-kb-dashboard/index.html>
2. Open browser console (F12)
3. Submit test queries:
   - "What is BIM?" (tests text + sources)
   - "What is the relationship between BIM and COBie?" (tests all modules)
4. Verify no console errors
5. Check all modules display correctly

---

## Rollback Procedure

### Rollback Frontend

```bash
# List recent versions
gsutil ls -a gs://bimei-kb-dashboard/index.html

# Restore previous version
gsutil cp gs://bimei-kb-dashboard/index.html#<generation> \
  gs://bimei-kb-dashboard/index.html
```

### Rollback Backend

```bash
# List recent revisions
gcloud functions describe dashboardApi \
  --gen2 \
  --region=australia-southeast1 \
  --format="value(serviceConfig.revision)"

# Traffic splitting to previous revision
gcloud run services update-traffic dashboardapi \
  --region=australia-southeast1 \
  --to-revisions=dashboardapi-00034-xyz=100
```

Or use local backup:

```bash
# If you have a backup file
gcloud functions deploy dashboardApi \
  --gen2 \
  --runtime=nodejs20 \
  --region=australia-southeast1 \
  --source=./backup-folder \
  --entry-point=dashboardApi \
  --trigger-http \
  --allow-unauthenticated
```

---

## Troubleshooting

### Function Deployment Fails

**Error**: "Build failed"

```bash
# Check build logs
gcloud functions logs read dashboardApi \
  --gen2 \
  --region=australia-southeast1 \
  --limit=100

# Verify package.json dependencies
npm install
npm audit fix
```

**Error**: "Invalid entry point"

- Verify `index.js` exports `dashboardApi` function
- Check `package.json` has correct `main` field

### Neo4j Connection Errors

**Error**: "The client is unauthorized due to authentication failure"

```bash
# Update password in Cloud Function
gcloud functions deploy dashboardApi \
  --gen2 \
  --update-env-vars NEO4J_PASSWORD="correct-password"
```

### CORS Errors

**Error**: "Access-Control-Allow-Origin"

- Backend already has CORS headers configured
- Verify request is from allowed origin
- Check browser console for specific CORS error

### GCS Upload Fails

**Error**: "Permission denied"

```bash
# Check bucket permissions
gsutil iam get gs://bimei-kb-dashboard

# Grant yourself access
gsutil iam ch user:your-email@domain.com:objectAdmin \
  gs://bimei-kb-dashboard
```

---

## Performance Optimization

### Enable CDN for GCS

```bash
# Create load balancer with CDN
# (Complex - see Cloud Console)
```

### Function Memory/Timeout

```bash
# Increase memory for better performance
gcloud functions deploy dashboardApi \
  --gen2 \
  --memory=1GB \
  --timeout=120s \
  --region=australia-southeast1
```

### Cold Start Optimization

```bash
# Set minimum instances (costs $$$)
gcloud functions deploy dashboardApi \
  --gen2 \
  --min-instances=1 \
  --region=australia-southeast1
```

---

## Security Best Practices

### Credentials Management

- **Never** commit `.env.yaml` to git
- Use Secret Manager for production:

```bash
# Create secret
echo -n "your-password" | gcloud secrets create neo4j-password \
  --data-file=-

# Grant function access to secret
gcloud secrets add-iam-policy-binding neo4j-password \
  --member=serviceAccount:your-service-account@bimei-ai.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### Public Access Control

The dashboard is currently **public** (unauthenticated).

To restrict access:

```bash
# Remove public access
gcloud functions remove-invoker-policy-binding dashboardApi \
  --region=australia-southeast1 \
  --member="allUsers" \
  --gen2

# Add specific users
gcloud functions add-invoker-policy-binding dashboardApi \
  --region=australia-southeast1 \
  --member="user:email@domain.com" \
  --gen2
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code tested locally
- [ ] Version number updated
- [ ] Environment variables verified
- [ ] Dependencies up to date (`npm audit`)
- [ ] No console errors in local testing
- [ ] Git commit with clear message

### Backend Deployment

- [ ] Cloud Function deployed successfully
- [ ] No build errors in logs
- [ ] Test API endpoint with curl
- [ ] Verify Neo4j connection works
- [ ] Check function metrics in console

### Frontend Deployment

- [ ] HTML file uploaded to GCS
- [ ] Cache headers set correctly
- [ ] Dashboard loads in browser
- [ ] All modules function correctly
- [ ] Test on mobile device

### Post-Deployment

- [ ] Live dashboard accessible
- [ ] Submit test queries
- [ ] Monitor logs for errors
- [ ] Update documentation if needed
- [ ] Notify team of changes

---

## CI/CD (Future Enhancement)

Currently, deployments are manual. Consider implementing:

### GitHub Actions Workflow

```yaml
name: Deploy Dashboard
on:
  push:
    branches: [main]
    paths:
      - 'bimei-kb-dashboard/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: google-github-actions/setup-gcloud@v0
      - name: Deploy Function
        run: |
          gcloud functions deploy dashboardApi ...
      - name: Deploy Frontend
        run: |
          gsutil cp B_Dashboard_UI.html gs://bimei-kb-dashboard/index.html
```

---

## Support & Resources

- **Dashboard URL**: <https://storage.googleapis.com/bimei-kb-dashboard/index.html>
- **Cloud Console**: <https://console.cloud.google.com/functions/details/australia-southeast1/dashboardApi?project=bimei-ai>
- **Documentation**: [README.md](README.md)
- **Issues**: Contact BIMei development team

---

**Last Updated**: January 2026
**Current Version**: v1.0.5
