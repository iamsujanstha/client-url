# DevOps Operations Manual: Continuous Deployment Blueprint
### AWS EC2 + GitHub Actions CI/CD + Docker Compose + Cloudflare DNS/SSL Integration

This operations manual serves as the standard, company-wide reference blueprint for provisioning, configuring, and maintaining production-grade containerized environments on **AWS EC2** using **GitHub Actions** and **Docker Compose**, behind a **Cloudflare CDN Active Reverse Proxy** with full edge SSL/TLS encryption.

---

## Document Metadata & Google Docs Copy Instructions
* **Author:** Principal DevOps Lead / Site Reliability Engineer
* **Target Audience:** DevOps Engineers, Software Engineers, Cloud Administrators
* **How to Import into Google Docs:** 
  1. Highlight and copy this entire guide (`Ctrl+A` or `Cmd+A` -> Copy).
  2. Create a new Google Document.
  3. Paste the contents into the document. Rich-text formatting (headers, tables, bold indices, code snippets) will automatically render in highly professional, polished styles.

---

## Section 1: End-to-End System Topology

The deployment architecture utilizes a **Server-Side, Push-Based deployment model** designed to keep resource usage on the EC2 host virtual machine (such as a cheap `t3.micro` or `t3.small` instance) at absolutely zero during the build phase. All heavy compilations and source analysis are handled within isolated GitHub-hosted runners before deploying cleanly over a secure SSH corridor.

```
+------------------------+
|   Developer GIT Push   |
+-----------┬------------+
            | (Pushes to main/master branch)
            ▼
+------------------------+
| GitHub Actions Runner  | <--- Triggers Linting, Checks, and Node Compilation
+-----------┬------------+
            | (Opens secure SSH Shell Connection via Port 22)
            ▼
+------------------------+
|   Target AWS EC2 Host  | <--- Coordinates git alignment, environment variables,
+-----------┬------------+      and invokes low-downtime Docker container recreation
            |
            | (Direct Inward Routing via Docker Port Mappings)
            ▼
+------------------------+
|  Docker Compose Engine | <--- Exposes Application to HTTP Host Port 80
+-----------┬------------+
            ▲
            | (Secure Edge Proxy & CDN Management)
            ▼
+------------------------+
| Cloudflare DNS Routing | <--- Manages Custom Domain Names and SSL/TLS Handshakes
+------------------------+
```

---

## Section 2: STEP 1 — AWS EC2 Provisioning & Security Group Setup

To ensure traffic reaches your servers successfully under various workloads, configure your target EC2 instance on AWS with absolute precision:

### 2.1 Navigate AWS Console to Edit Security Groups
1. Log into your **AWS Management Console**.
2. Search for and select **EC2** in the services bar.
3. In the left navigation pane under **Network & Security**, click on **Security Groups**.
4. Single-click the security group associated with your target EC2 instance.
5. In the bottom-right panel, click on the **Inbound rules** tab, then click the **Edit inbound rules** button.

### 2.2 Add Specific Firewall Inbound Rules
Configure exactly three rules as shown in the security matrix below. Removing standard defaults prevents port blockage issues:

| Security Group Rule ID | Port Range | Protocol | Source / IP CIDR | Technical Purpose / Description |
| :--- | :--- | :--- | :--- | :--- |
| `sgr-HTTP` | **`80`** | `TCP` | `0.0.0.0/0` | **Public HTTP Web Access:** Allows Cloudflare edge networks to route customer queries directly into the host machine. |
| `sgr-SSH` | **`22`** | `TCP` | `0.0.0.0/0` (or company IP range) | **SSH Management:** Essential for GitHub Actions CI/CD to connect, authenticate with private keys, and build code. |
| `sgr-HTTPS` | **`443`** | `TCP` | `0.0.0.0/0` | **Public HTTPS Web Access:** Retained to allow secure edge redirects and custom reverse proxies. |

*Click the **Save rules** button immediately at the bottom right of the panel to apply the configurations.*

---

## Section 3: STEP 2 — EC2 Host System Initialization & Provisioning Script

When starting with a completely fresh Ubuntu instance, running a basic command like `sudo apt-get install docker-compose-plugin` will fail with the error `E: Unable to locate package docker-compose-plugin`. This occurs because standard Ubuntu base repositories do not contain Docker’s official container orchestration tools by default.

### 3.1 Establishing Connection to the Host
Connect to your EC2 instance via your terminal:
```bash
ssh -i "your-aws-pem-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

### 3.2 Automated Host Setup Script
Execute this script to configure Docker's official GPG keychains, align official package repositories, configure execution binaries, and solve standard UNIX permissions issues:

```bash
#!/usr/bin/env bash
# Official Docker & Docker Compose V2 Provisioning Script for Ubuntu LTS
set -euo pipefail

echo "=========================================================="
echo "ST_01: Refreshing system registries and upgrading core libraries..."
echo "=========================================================="
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git apt-transport-https ca-certificates gnupg lsb-release

echo "=========================================================="
echo "ST_02: Adding Docker's Official Secure Cryptographic GPG Key..."
echo "=========================================================="
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "=========================================================="
echo "ST_03: Adding Official Docker Repository to APT Sources..."
echo "=========================================================="
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "=========================================================="
echo "ST_04: Installing Docker Engine, Docker CLI, and Compose V2 Plugin..."
echo "=========================================================="
# This resolves the "Unable to locate package docker-compose-plugin" error
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=========================================================="
echo "ST_05: Resolving Unix System Docker Socket Permissions..."
echo "=========================================================="
# Resolves the connection permission denied issue: "permission denied while trying to connect to the Docker daemon socket"
sudo usermod -aG docker $USER

echo "=========================================================="
echo "PROVISIONING COMPLETE"
echo "=========================================================="
echo "CRITICAL: Re-initialize terminal system group permissions by typing: 'newgrp docker'"
echo "Verify successful installations by running: 'docker compose version' and 'docker --version'"
```

### 3.3 Critical Group Authorization Command
To activate user socket groupings immediately without logging out of the SSH shell terminal:
```bash
newgrp docker
```
*If a permission denied error persists when running `docker compose ps` later, verify using `groups` that `docker` is listed. Alternatively, close the terminal window and re-open the SSH session.*

---

## Section 4: STEP 3 — GitHub Secrets Configuration for CI/CD

To authorize your build pipeline to connect securely with AWS without committing plain-text credentials, configure the following secrets inside GitHub:

### 4.1 Navigation Guide inside GitHub
1. Open your code repository on **GitHub**.
2. Click the **Settings** tab (the gear icon listed in the main horizontal menu under your repository name).
3. On the left sidebar menu, look for the **Security** grouping, expand **Secrets and variables**, then click on **Actions**.
4. Under the **Repository secrets** tab, click **New repository secret**.

### 4.2 Key/Value Configuration Requirements

Add these four secrets exactly as outlined below to construct the pipeline handshake:

1. **`EC2_HOST`**: The **Public IPv4 Address** or **Elastic IP** of your EC2 instance (e.g., `54.210.xx.xx`). If you are utilizing a domain name behind active proxy protection, you *must* use your raw public IP address here, because proxies block direct SSH handshakes.
2. **`EC2_USER`**: Set this to **`ubuntu`** (this is the standard immutable default administrative username for vanilla AWS Ubuntu AMIs).
3. **`EC2_SSH_KEY`**: Paste the entire contents of your private key file (e.g., `your-aws-pem-key.pem` file downloaded from AWS during key-pair generation). It must include of all lines:
   ```text
   -----BEGIN RSA PRIVATE KEY-----
   MIIEpAIBAAKCAQEA08d20K...
   ...
   -----END RSA PRIVATE KEY-----
   ```
   *Ensure there is a single blank line at the bottom when pasting to prevent parse failures.*
4. **`EC2_PROJECT_PATH`**: The desired absolute deployment target folder path inside the machine's home storage space.
   *Recommended value:* `/home/ubuntu/hypercur`

---

## Section 5: Step-by-Step Resolution of Real-World Production Failures

During our build system alignment, we isolated and fixed the following real-world DevOps failures:

### 5.1 Docker Copy Cache Error (`/app/data: not found`)
* **The Failure:** 
  During execution of the multi-stage Dockerfile compiler assembly, the runner crashed during Stage 2:
  ```text
  failed to solve: failed to compute cache key: failed to calculate checksum of ref... "/app/data": not found
  ```
* **The Root Cause:** 
  The codebase utilized a `COPY --from=builder /app/data ./data` line inside the Dockerfile. Because `/app/data` is configured inside the `.dockerignore` or might not exist in the temporary builder stage, Docker was unable to locate it, causing the entire container compilation to crash.
* **The DevOps Solution:**
  We replaced the hard copy step with a robust runtime instruction:
  ```dockerfile
  # Clean, modern approach — initialize the persistence directory layout locally at run-time
  RUN mkdir -p data
  ```
  This creates the data container namespace cleanly at start-up time and avoids structural build failures, allowing you to use `./data` mount-points consistently on your host systems.

### 5.2 UNIX Socket Permission Denied Error (`/var/run/docker.sock: permission denied`)
* **The Failure:** 
  Executing commands like `docker compose ps` results in a daemon socket connection blockage:
  ```text
  permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock
  ```
* **The Root Cause:** 
  By default, the host's `/var/run/docker.sock` socket is protected and owned by the `root` administrative profile. Standard users do not have access rights to this connection channel unless they are explicitly enrolled in the system's `docker` permissions group.
* **The DevOps Solution:**
  Run these commands to verify group enrollment and apply socket updates:
  ```bash
  sudo usermod -aG docker ubuntu
  newgrp docker
  ```

---

## Section 6: STEP 4 — Transitioning raw IP views into Cloudflare Domains

To transition your system from a raw IP address (e.g. `http://54.210.150.85`) to a polished, professional custom domain (e.g. `https://yourdomain.com`), follow this setup checklist:

### 6.1 Cloudflare DNS Setup
1. Log in to your **Cloudflare Dashboard**.
2. Select your registered domain name, then navigate to **DNS** -> **Records** page on the left menu.
3. Remove any pre-existing routing `A` records to avoid hostname conflicts.
4. Add the following records:

| Record Type | Name (Host) | IPv4 Target IP Address | Proxy Status | TTL | Technical Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`A`** | `@` | `YOUR_EC2_PUBLIC_IP` | **Proxied (Orange Cloud - ON)** | Auto | Directs base root domain traffic securely through to your public AWS EC2 host IP |
| **`CNAME`** | `www` | `yourdomain.com` | **Proxied (Orange Cloud - ON)** | Auto | Redirects `www.yourdomain.com` directly back onto your root domain |

*Example configuration values:*
* `Type: A`
* `Name: @`
* `IPv4 Address: 54.210.150.85`
* `Proxy status: Proxied`

---

### 6.2 SSL/TLS Mode Configuration
Cloudflare handles complete edge SSL termination, meaning visitors access your site securely via HTTPS without your application needing to manage or renew local certificate key-pairs manually.

1. In the Cloudflare left navigation sidebar, click on **SSL/TLS**.
2. Under the **Overview** section, click the **Flexible** or **Full** encryption option card:
   * **`Flexible (Recommended for Ease)`**: Cloudflare manages all HTTPS connections from visitors' browsers to the CDN Edge. Communications traveling from Cloudflare edge nodes down to your EC2 instance are routed cleanly via standard HTTP on Port 80.
   * **How it saves resource costs:** This mode allows your Docker app container to listen directly on port `3000` mapped onto host Port `80` without installing extra Nginx certificates or certbot renewal scripts internally.

---

### 6.3 Resolving the Infinite REDIRECT Loop Error (`ERR_TOO_MANY_REDIRECTS`)
* **The Failure:** 
  When you access your newly configured domain, the browser page fails to load and returns a web crash block stating `ERR_TOO_MANY_REDIRECTS`.
* **The Root Cause:** 
  If your application server is explicitly configured to detect non-secure requests and redirect users back to `https://`, a conflict occurs. Under Cloudflare’s **Flexible SSL/TLS mode**, Cloudflare routes its inward requests down to your AWS EC2 using HTTP on Port 80. Your web application detects an HTTP connection, redirects the visitor back to HTTPS, and sends this request to Cloudflare. Cloudflare then reaches your app via HTTP again, starting an infinite redirect loop.
* **The Step-by-Step Resolution:**
  1. Set your Cloudflare **SSL/TLS Mode** to **Full** (or **Full Strict** if you decide to load self-signed cert blocks onto port 443 of the server later).
  2. If using **Flexible SSL/TLS**, configure your application code (e.g. middlewares inside Express servers) to disable global force-redirection.
  3. Instead of forcing redirects inside your web server, let Cloudflare manage the redirect logic at its edge network. To do this, navigate to the Cloudflare dashboard, go to **SSL/TLS** -> **Edge Certificates**, and toggle **Always Use HTTPS** to **ON**. This ensures all HTTP requests automatically upgrade to secure HTTPS before reaching your app server.

---

## Section 7: Running Checks & Diagnosis Playbook

Once the CI/CD pipeline completes with a green checkmark, use these diagnostic commands to confirm the site's health:

### 7.1 Check Running Container Status
Connect to your EC2 Shell and run:
```bash
docker compose ps
```
*Your active node mappings should look like: `0.0.0.0:80->3000/tcp`. This confirms that host Port 80 traffic is routing directly to Port 3000 inside your Docker environment.*

### 7.2 Read Container Engine Logs
```bash
docker compose logs -f --tail=100
```

### 7.3 Release Host Ports blockages
If the container fails to launch due to port assignment issues, check which system process (such as standalone host installations of Apache or Nginx) is already using port 80:
```bash
sudo lsof -i :80
```
Stop and disable those standalone processes to release Port 80 access:
```bash
sudo systemctl stop nginx || sudo systemctl stop apache2
sudo systemctl disable nginx || sudo systemctl disable apache2
```
Now, re-trigger your container startup:
```bash
docker compose up -d
```

---

*This operations blueprint is fully finalized and ready for your DevOps team to manage, maintain, and automate your deployments.*
