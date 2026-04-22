const { execSync } = require('child_process');
const path = require('path');

const projectDir = '/vercel/share/v0-project';

try {
  console.log('[v0] Starting force push to GitHub main branch...');
  process.chdir(projectDir);
  
  // Get current branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  console.log(`[v0] Current branch: ${currentBranch}`);
  
  // Add all changes
  console.log('[v0] Staging all changes...');
  execSync('git add -A', { encoding: 'utf8' });
  
  // Check if there are changes to commit
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.length > 0) {
    console.log('[v0] Creating commit with all changes...');
    execSync('git commit -m "Force push: All current changes"', { encoding: 'utf8' });
  } else {
    console.log('[v0] No changes to commit');
  }
  
  // Force push to main
  console.log('[v0] Force pushing to origin/main...');
  execSync('git push origin HEAD:main --force', { encoding: 'utf8' });
  
  console.log('[v0] ✓ Successfully force pushed all changes to GitHub main branch!');
} catch (error) {
  console.error('[v0] Error during force push:', error.message);
  process.exit(1);
}
