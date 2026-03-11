# Daily Workflow (VS Code + Git Bash)

Use this every time you continue coding.

## 1) Start working locally

Open VS Code in:

`C:\Users\Hem\Desktop\App development\Lobos Shop`

Open Git Bash in the same folder and run:

```bash
cd "/c/Users/Hem/Desktop/App development/Lobos Shop"
git pull origin main  (Skip this for now)
```

Then edit code in VS Code.

## 2) Save and push your changes

In top left of VS Code, go to Source Control and put the name of the changes and the commit.

## 3) Deploy latest code to VPS

SSH to VPS:

```bash
ssh root@161.97.68.242
```

On VPS, run:

```bash
cd /var/www/LobosShop
git pull origin main
```

## 4) Restart app only if backend changed (Not needed now)

If you changed backend files (like `server/server.js`, routes, DB logic, `.env`), run:

```bash
pm2 restart step-challenge
```

If you changed only frontend files in `server/public/` (`index.html`, `style.css`, `script.js`), restart is usually not needed.

## 5) Verify site (I can verify by going myself to the website instead)

Run:

```bash
curl https://lobos.se/api/health
```

Then open `https://lobos.se` in browser.
If page looks old, do hard refresh: `Ctrl+F5`.

## Quick Troubleshooting

- VPS not showing latest changes:
  - `cd /var/www/LobosShop && git log -1 --oneline`
  - Compare with GitHub latest commit.
- App down:
  - `pm2 list`
  - `pm2 logs step-challenge --lines 50`
