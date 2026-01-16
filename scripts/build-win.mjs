import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildDir = join(root, 'build');
const seaConfig = join(root, 'sea.json');
const blob = join(buildDir, 'oa.blob');
const exe = join(buildDir, 'oa.exe');

// Get version from package.json
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = packageJson.version;

/* Ensure build directory */
if (!existsSync(buildDir)) {
    mkdirSync(buildDir);
}

/* Step 1: Generate SEA blob */
execSync(
    `"${process.execPath}" --experimental-sea-config "${seaConfig}"`,
    { stdio: 'inherit' }
);

/* Step 2: Copy Node runtime */
copyFileSync(process.execPath, exe);

/* Step 3: Inject blob */
execSync(
    `"${join(root, 'node_modules', '.bin', 'postject.cmd')}" "${exe}" NODE_SEA_BLOB "${blob}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { stdio: 'inherit' }
);

/* Step 4: Create distribution package */
const distFolder = join(root, '../../builds');
if (!existsSync(distFolder)) {
    mkdirSync(distFolder, { recursive: true });
}

// Create versioned executable name
const distExeName = `oa.exe`;
const destExe = join(distFolder, distExeName);
copyFileSync(exe, destExe);

// Create zip file for distribution
const zipName = `oa-cli-v${version}-windows.zip`;
const zipPath = join(distFolder, zipName);

// Copy README to dist folder for inclusion in zip
const readmeSrc = join(root, 'scripts', 'dist-readme.md');
const readmeDest = join(distFolder, 'README.md');
copyFileSync(readmeSrc, readmeDest);

try {
    execSync(
        `powershell "Compress-Archive -Path '${destExe}', '${readmeDest}' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
    );
    console.log('\n✔ Distribution package created:', zipPath);
} catch (error) {
    console.log('\n⚠️  Could not create zip file, but exe is ready:', destExe);
}

console.log('\n✔ Windows SEA build complete!');
console.log(`📦 Distribution file: ${destExe}`);
console.log(`📦 Zip archive: ${zipPath}`);
console.log(`📏 File size: ${Math.round(statSync(destExe).size / 1024 / 1024)}MB`);
