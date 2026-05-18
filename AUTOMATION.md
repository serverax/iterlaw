# 🚀 ITERLAW AUTOMATION

## Overview
This repository contains a fully automated CI/CD pipeline for the IterLaw RAG application.

## Pipelines
1. **Daily Scraping Pipeline** (01-scrape-daily.yml)
   - Runs daily at 2 AM UTC.
   - Pulls data from legislation.gov.uk, GOV.UK, ACAS, and National Archives.
   - Updates the PostgreSQL database.
   - Creates a daily backup.
   - Notifies Slack.

2. **Chunking & Embeddings** (02-chunk-embed.yml)
   - Triggers automatically after scraping.
   - Splits text into RAG chunks.
   - Generates vector embeddings via Ollama.

3. **RAG Validation** (03-validate-rag.yml)
   - Triggers after embeddings are ready.
   - Runs accuracy tests on the knowledge base.

4. **Docker Build** (04-build-docker.yml)
   - Runs on every push to `main`.
   - Builds and pushes the RAG API image to Docker Hub.

5. **Production Deploy** (05-deploy.yml)
   - Triggers after a successful Docker build on `main`.
   - Deploys the latest image to the production server via SSH.

## Setup
Required GitHub Secrets:
- `DB_PASSWORD`: PostgreSQL password.
- `SLACK_WEBHOOK`: Slack notification URL.
- `DOCKER_USERNAME`: Docker Hub username.
- `DOCKER_PASSWORD`: Docker Hub token.
- `DEPLOY_KEY`: SSH private key for production.
- `SERVER_HOST`: Production server IP.
