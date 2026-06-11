# 🚀 Deployment Quick Start

Choose your preferred deployment platform and follow the steps.

## Deployment Options

### **Option 1: Railway.app** ⭐ (Easiest - 5 minutes)
### **Option 2: Heroku** (Popular - 10 minutes)
### **Option 3: Docker + DigitalOcean** (Professional - 15 minutes)
### **Option 4: AWS EC2** (Scalable - 20 minutes)
### **Option 5: Local Docker** (Development - 5 minutes)

---

## 🚀 Option 1: Railway.app (EASIEST)

Railway automatically deploys from GitHub with zero configuration!

### Step 1: Connect GitHub
1. Go to https://railway.app
2. Click "Create New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select `akramdesyber6-ops/smart-school-erp`

### Step 2: Configure Environment
Railway creates environment variables automatically. Add these:

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-school-erp
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRATION=24h
CORS_ORIGIN=https://your-domain.com
```

### Step 3: Add MongoDB Plugin
1. In Railway dashboard, click "Add Service"
2. Select "MongoDB"
3. Railway auto-connects it to your app

### Step 4: Deploy
1. Click "Deploy"
2. Wait 2-3 minutes for build
3. Get your URL (https://smart-school-erp-xxxxx.railway.app)

### Step 5: Test
```bash
curl https://your-railway-url.railway.app/health
```

**✅ Done! Your app is live!**

---

## 🚀 Option 2: Heroku

### Step 1: Install Heroku CLI
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Linux
curl https://cli-assets.heroku.com/install.sh | sh

# Windows
Download from https://devcenter.heroku.com/articles/heroku-cli
```

### Step 2: Login to Heroku
```bash
heroku login
```

### Step 3: Create App
```bash
heroku create smart-school-erp
```

### Step 4: Add MongoDB Atlas
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string

### Step 5: Set Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smart-school-erp
heroku config:set JWT_SECRET=your-secret-key-here
heroku config:set JWT_EXPIRATION=24h
heroku config:set CORS_ORIGIN=https://smart-school-erp.herokuapp.com
```

### Step 6: Deploy
```bash
git push heroku main
```

### Step 7: View App
```bash
heroku open
```

### Step 8: Check Logs
```bash
heroku logs --tail
```

**✅ Done! App is on Heroku!**

---

## 🚀 Option 3: Docker + DigitalOcean (Professional)

### Step 1: Create DigitalOcean Account
- Go to https://www.digitalocean.com
- Sign up and add payment method
- Get $100 free credit with GitHub Student

### Step 2: Create Droplet
```bash
# In DigitalOcean console:
# 1. Click "Create" > "Droplets"
# 2. Choose "Ubuntu 22.04"
# 3. Select "Basic" plan ($6/month)
# 4. Add SSH key for authentication
# 5. Click "Create Droplet"
```

### Step 3: SSH into Droplet
```bash
ssh root@your_droplet_ip
```

### Step 4: Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker root
```

### Step 5: Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 6: Clone Repository
```bash
git clone https://github.com/akramdesyber6-ops/smart-school-erp.git
cd smart-school-erp
```

### Step 7: Create Production .env
```bash
nano .env
```

Add:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo:27017/smart-school-erp
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h
CORS_ORIGIN=https://your-domain.com
```

### Step 8: Start Services
```bash
docker-compose up -d
```

### Step 9: Check Status
```bash
docker-compose ps
docker logs smart-school-erp
```

### Step 10: Setup Nginx Reverse Proxy
```bash
sudo apt-get install nginx
```

Create `/etc/nginx/sites-available/smart-school-erp`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/smart-school-erp /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

### Step 11: Add SSL (Free with Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**✅ Done! Professional deployment complete!**

---

## 🚀 Option 4: AWS EC2 (Scalable)

### Step 1: Launch EC2 Instance
1. Go to AWS Console
2. Click EC2 > "Launch Instances"
3. Choose Ubuntu 22.04 LTS
4. Select t3.micro (free tier eligible)
5. Configure security groups (allow ports 80, 443, 3000)
6. Create/download SSH key pair
7. Launch instance

### Step 2: Connect to Instance
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ec2-user@your-instance-ip
```

### Step 3: Install Node.js
```bash
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### Step 4: Install MongoDB (or use MongoDB Atlas)
```bash
# For production, use MongoDB Atlas cloud service
# Create account at https://www.mongodb.com/cloud/atlas
```

### Step 5: Clone and Setup
```bash
git clone https://github.com/akramdesyber6-ops/smart-school-erp.git
cd smart-school-erp
npm install
cp .env.example .env
nano .env  # Edit with your values
npm run build
```

### Step 6: Install PM2
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### Step 7: Setup Nginx
```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create Nginx config as in Option 3.

### Step 8: Add SSL Certificate
```bash
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**✅ Done! AWS deployment complete!**

---

## 🚀 Option 5: Local Docker (Development/Testing)

### Step 1: Build & Run Locally
```bash
cd smart-school-erp
docker-compose up -d
```

### Step 2: Check Services
```bash
docker-compose ps
```

### Step 3: View Logs
```bash
docker-compose logs -f app
```

### Step 4: Access App
```bash
curl http://localhost:3000/health
```

### Step 5: Stop Services
```bash
docker-compose down
```

**✅ Done! Local deployment ready!**

---

## 📋 Pre-Deployment Checklist

- [ ] `npm run build` - Compiles successfully
- [ ] `npm run test` - All tests pass
- [ ] `npm run lint` - No linting errors
- [ ] `.env` file created with all variables
- [ ] `MONGODB_URI` configured
- [ ] `JWT_SECRET` set to strong random string
- [ ] `CORS_ORIGIN` set correctly
- [ ] SSL/HTTPS configured (production only)
- [ ] Health check endpoint works
- [ ] Database connection verified

---

## 🔒 Security for Production

### Required Settings:
```env
NODE_ENV=production
JWT_SECRET=<64-character-random-string>
```

### Generate Strong Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### SSL Certificate (Required):
- Use Let's Encrypt (free)
- Update all URLs to HTTPS
- Set CORS_ORIGIN to HTTPS URL

### Firewall Rules:
- Only expose ports 80, 443
- Restrict database to app only
- Use environment variables for secrets

---

## 📊 Comparison

| Platform | Ease | Cost | Speed | Scalability |
|----------|------|------|-------|-------------|
| Railway | ⭐⭐⭐⭐⭐ | $5/mo | 5 min | High |
| Heroku | ⭐⭐⭐⭐ | Free - $25/mo | 10 min | Medium |
| DigitalOcean | ⭐⭐⭐ | $6/mo | 15 min | High |
| AWS EC2 | ⭐⭐ | Variable | 20 min | Very High |
| Local Docker | ⭐⭐⭐⭐ | Free | 5 min | Low |

---

## ✅ Deployment Verification

After deploying, test these endpoints:

### Health Check
```bash
curl https://your-app.com/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-06-08T12:45:00.000Z"
}
```

### API Root
```bash
curl https://your-app.com/api
```

### Register User
```bash
curl -X POST https://your-app.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Login
```bash
curl -X POST https://your-app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## 🆘 Deployment Issues

### MongoDB Connection Failed
- Verify MONGODB_URI in .env
- Check MongoDB Atlas IP whitelist
- Ensure credentials are correct

### Port Already in Use
- Change PORT in .env
- Kill process on port: `lsof -ti:3000 | xargs kill -9`

### SSL Certificate Error
- Use Let's Encrypt for free: `sudo certbot --nginx -d your-domain.com`
- Wait for certificate to be issued

### App Crashes on Startup
- Check logs: `docker logs app` or `pm2 logs`
- Verify .env file
- Ensure MongoDB is running

### High Memory Usage
- Increase server size
- Implement caching
- Check for memory leaks

---

## 📞 Support

- **Documentation**: See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Issues**: https://github.com/akramdesyber6-ops/smart-school-erp/issues
- **Questions**: https://github.com/akramdesyber6-ops/smart-school-erp/discussions
- **Email**: support@smartschoolerp.com

---

## 🎉 Congratulations!

Your Smart School ERP is now deployed and running! 🚀

**Next Steps:**
1. Monitor logs and health
2. Setup monitoring (see docs/MONITORING.md)
3. Configure backups
4. Add domain name
5. Enable HTTPS

---

**Happy Deploying! 🎓**
