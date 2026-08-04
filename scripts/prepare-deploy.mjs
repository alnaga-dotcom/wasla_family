import { mkdirSync, rmSync, existsSync, copyFileSync, cpSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEPLOY = join(ROOT, 'deploy');

const API_BASE = process.env.WASLA_API_BASE || 'https://wasla-family.onrender.com';
const APP_URL = process.env.WASLA_APP_URL || 'https://app.wasla.family';
const DOMAIN = process.env.WASLA_DOMAIN || 'wasla.family';

if (existsSync(DEPLOY)) rmSync(DEPLOY, { recursive: true, force: true });
mkdirSync(DEPLOY, { recursive: true });

// Build app www with production API base
console.log('Building app www with API_BASE =', API_BASE);
execSync('npm run build:www', {
  cwd: join(ROOT, 'wasla-app'),
  env: { ...process.env, WASLA_API_BASE: API_BASE },
  stdio: 'inherit',
});

// Package app
const appSrc = join(ROOT, 'wasla-app', 'www');
const appDst = join(DEPLOY, 'app');
cpSync(appSrc, appDst, { recursive: true, force: true });
writeFileSync(join(appDst, '.htaccess'), `DirectoryIndex index.html
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`);

// Package landing
const landingSrc = join(ROOT, 'wasla-landing');
const landingDst = join(DEPLOY, 'landing');
mkdirSync(landingDst, { recursive: true });
for (const f of ['index.html', 'css', 'js', 'assets', 'images', 'manifest.webmanifest', 'sw.js']) {
  const src = join(landingSrc, f);
  if (!existsSync(src)) continue;
  const dst = join(landingDst, f);
  const stat = (await import('node:fs')).statSync(src);
  if (stat.isDirectory()) cpSync(src, dst, { recursive: true, force: true });
  else copyFileSync(src, dst);
}
writeFileSync(join(landingDst, 'config.json'), JSON.stringify({ apiBase: API_BASE, appUrl: APP_URL }, null, 2));
writeFileSync(join(landingDst, '.htaccess'), `DirectoryIndex index.html
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`);

// Copy release APK if available
const apkSrc = join(ROOT, 'wasla-app', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (existsSync(apkSrc)) copyFileSync(apkSrc, join(DEPLOY, 'wasla.apk'));

// Write deploy instructions
const readme = `# Wasla Deployment Package

Generated for domain: ${DOMAIN}
Backend API base: ${API_BASE}
App URL: ${APP_URL}

## Files

- \`landing/\` → upload to the root of ${DOMAIN} (public_html).
- \`app/\` → upload to the subdomain or folder where the app lives (e.g., app.${DOMAIN} or ${DOMAIN}/app).
- \`wasla.apk\` → Android installable APK. Place it in \`landing/\` or link to it from the landing page.

## Shared host steps (cPanel)

1. Upload \`landing/\` contents to \`public_html\`.
2. Create a subdomain \`app.${DOMAIN}\` pointing to a folder, then upload \`app/\` contents there.
3. Ensure \`mod_rewrite\` is enabled (the included \`.htaccess\` handles SPA routing).
4. Update DNS A record for ${DOMAIN} to your shared host IP.

## Backend (Render / Railway)

1. Create a new Web Service from \`wasla-server/\`.
2. Use the included \`Dockerfile\`.
3. Set environment variables:
   - \`WASLA_PUBLIC_DOMAIN=https://${DOMAIN}\`
   - \`WASLA_CORS_ORIGINS=https://${DOMAIN},https://app.${DOMAIN},https://www.${DOMAIN}\`
   - \`WASLA_ADMIN_KEY\` (generate a strong random key)
   - \`WASLA_TRUST_PROXY=1\`
   - \`WASLA_UPLOADS_DIR=/app/data/uploads\`
   - \`WASLA_DEV_OTP=false\`
4. **OTP provider is required**: production refuses to boot unless
   \`WASLA_OTP_PROVIDER=twilio\` or \`email\` with valid credentials is set.
   - Twilio: \`TWILIO_ACCOUNT_SID\`, \`TWILIO_AUTH_TOKEN\`, \`TWILIO_PHONE_NUMBER\`
   - Email: \`SMTP_HOST\`, \`SMTP_USER\`, \`SMTP_PASS\` (\`SMTP_PORT\`, \`SMTP_SECURE\`, \`SMTP_FROM\` optional)
5. Add a disk/volume mounted at \`/app/data\` so the SQLite database and uploads persist.
6. Health check path: \`/api/health\`.

## Android APK

The included APK already points to \`${API_BASE}\`. To rebuild after changing the API:

\`\`\`powershell
$env:WASLA_API_BASE='${API_BASE}'
npm run cap:build:release
\`\`\`
`;
writeFileSync(join(DEPLOY, 'README.md'), readme);

console.log('Deploy package ready at', DEPLOY);
console.log('  landing/  -> public_html of', DOMAIN);
console.log('  app/      -> app subdomain of', DOMAIN);
console.log('  wasla.apk -> download link');
