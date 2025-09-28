#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  console.error('SERVICE_ACCOUNT_PATH environment variable is required.');
  process.exit(1);
}

const absolutePath = path.resolve(serviceAccountPath);

if (!fs.existsSync(absolutePath)) {
  console.error(`Service account file not found at ${absolutePath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

const uid = process.argv[2] || 'cutschedule-user';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

admin
  .auth()
  .createCustomToken(uid)
  .then((token) => {
    process.stdout.write(token);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error creating custom token:', error);
    process.exit(1);
  });

