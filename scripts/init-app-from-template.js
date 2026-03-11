#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, obj) {
  const raw = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(filePath, raw, 'utf8');
}

function askQuestion(rl, prompt, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]: ` : ': ';
  return new Promise((resolve) => {
    rl.question(prompt + suffix, (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

function updateAzureYaml(azurePath, newName) {
  if (!fs.existsSync(azurePath)) {
    console.warn(`Skipped azure.yaml update (file not found at ${azurePath})`);
    return;
  }

  const raw = fs.readFileSync(azurePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let changed = false;

  const updatedLines = lines.map((line) => {
    if (!changed && /^name:\s*/.test(line.trim())) {
      changed = true;
      return `name: ${newName}`;
    }
    return line;
  });

  if (!changed) {
    console.warn('Did not find a name: line in azure.yaml; no change made.');
    return;
  }

  fs.writeFileSync(azurePath, updatedLines.join('\n'), 'utf8');
}

function updateReadme(readmePath, newDisplayName) {
  if (!fs.existsSync(readmePath)) {
    console.warn(`Skipped README update (file not found at ${readmePath})`);
    return;
  }

  const raw = fs.readFileSync(readmePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0) return;

  if (/^#\s+/.test(lines[0])) {
    lines[0] = `# ${newDisplayName}`;
    fs.writeFileSync(readmePath, lines.join('\n'), 'utf8');
  } else {
    console.warn('README does not start with a heading; leaving unchanged.');
  }
}

async function main() {
  const root = process.cwd();

  const templateConfigPath = path.join(root, 'template.config.json');
  const azureYamlPath = path.join(root, 'azure.yaml');
  const readmePath = path.join(root, 'README.md');

  const templateConfig = readJson(templateConfigPath);
  const currentSlug = templateConfig.appSlug || 'my_app';
  const currentDisplayName = templateConfig.appDisplayName || 'My App';

  let azureNameDefault = currentSlug.replace(/_/g, '-');
  if (fs.existsSync(azureYamlPath)) {
    const azureRaw = fs.readFileSync(azureYamlPath, 'utf8');
    const match = azureRaw.match(/^\s*name:\s*(.+)\s*$/m);
    if (match && match[1]) {
      azureNameDefault = match[1].trim();
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('Initialize this repo as a new app based on the template.');
    console.log('Values are used for infra naming, docs, and pipelines.\n');

    const appSlug = await askQuestion(
      rl,
      'App slug (machine-readable, e.g. vendvault_billing)',
      currentSlug
    );

    const appDisplayName = await askQuestion(
      rl,
      'App display name (e.g. VendVault Billing)',
      currentDisplayName
    );

    const azureName = await askQuestion(
      rl,
      'Azure app name in azure.yaml (a-z, 0-9, and dashes)',
      azureNameDefault
    );

    // Update template.config.json
    const updatedConfig = {
      ...templateConfig,
      appSlug,
      appDisplayName,
    };
    writeJson(templateConfigPath, updatedConfig);
    console.log(`Updated template.config.json with appSlug="${appSlug}", appDisplayName="${appDisplayName}".`);

    // Update azure.yaml name
    updateAzureYaml(azureYamlPath, azureName);
    console.log(`Updated azure.yaml name to "${azureName}".`);

    // Update README heading
    updateReadme(readmePath, appDisplayName);
    console.log(`Updated README heading to "# ${appDisplayName}".`);

    console.log('\nDone.');
    console.log('Next steps per repo:');
    console.log('- Push this repo to GitHub.');
    console.log('- Run "azd pipeline config" in this repo.');
    console.log('- Set GitHub Actions variables/secrets as described in docs (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, APP_SLUG, POSTGRES_ADMIN_PASSWORD, etc.).');
  } catch (err) {
    console.error('Error initializing app from template:', err.message || err);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();

