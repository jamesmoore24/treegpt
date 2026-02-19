---
name: deploy
description: Commit changes, push to main, rebuild, and restart the app
disable-model-invocation: true
allowed-tools: Bash
---

# Deploy TreeGPT

Run the following steps in order to deploy the current state of the project:

1. **Stage and commit** all changed files to git on the `main` branch with a descriptive commit message summarizing the changes.
2. **Push** to `origin main`.
3. **Build** the Next.js production bundle: `cd /home/ec2-user/treegpt && npm run build`
4. **Restart** the app via PM2: `pm2 restart treegpt`
5. **Verify** the app is running: `pm2 status treegpt` and confirm status is "online".

If the build fails, do NOT restart. Fix the build error first, then retry from step 3.

If there are no changes to commit, skip steps 1-2 and just rebuild and restart.
