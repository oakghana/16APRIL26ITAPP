const { execSync } = require('child_process');

console.log('[v0] Force pushing to oakghana/qccitapp main branch...');

try {
  // Check git status
  console.log('[v0] Current git status:');
  const status = execSync('git status', { encoding: 'utf-8' });
  console.log(status);

  // Add all changes
  console.log('[v0] Staging all changes...');
  execSync('git add -A', { encoding: 'utf-8' });

  // Check if there are changes to commit
  const diff = execSync('git diff --cached --quiet', { encoding: 'utf-8' }).catch(() => true);
  
  // Get current commit hash
  const currentHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  console.log(`[v0] Current commit: ${currentHash}`);

  // Add remote if it doesn't exist
  console.log('[v0] Adding qccitapp remote...');
  try {
    execSync('git remote remove qccitapp', { encoding: 'utf-8' });
  } catch (e) {
    // Remote doesn't exist yet, that's fine
  }
  
  execSync('git remote add qccitapp https://github.com/oakghana/qccitapp.git', { encoding: 'utf-8' });
  console.log('[v0] qccitapp remote added');

  // Fetch to ensure we have latest
  console.log('[v0] Fetching qccitapp...');
  execSync('git fetch qccitapp', { encoding: 'utf-8' });

  // Force push to qccitapp main
  console.log('[v0] Force pushing to qccitapp main...');
  const pushOutput = execSync('git push -f qccitapp HEAD:main', { encoding: 'utf-8' });
  console.log('[v0] Push output:', pushOutput);

  console.log('[v0] ✓ Successfully force pushed to oakghana/qccitapp main branch!');
} catch (error) {
  console.error('[v0] Error during force push:', error.message);
  process.exit(1);
}
