// npm install -g pkg

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path')
const readline = require('readline');


let _nodeVersion = 'node16'
let _platform = 'win'
let _architecture = 'x64'

// node16-win-x64,
// node16-macos-x64,
// node16-linux-x64,
// node16-macos-arm64,
// node16-linux-arm64

const _getValue = (key) => {
    const valueIndex = process.argv.indexOf(`--${key}`);
    if (valueIndex !== -1 && process.argv[valueIndex + 1]) {
        return process.argv[valueIndex + 1];
    }
}

const _ensureDir = (folder) => {

    const buildsFolderPath = path.resolve(__dirname, folder);

    // Check if the folder exists, and create it if it doesn't
    if (!fs.existsSync(buildsFolderPath)) {
        fs.mkdirSync(buildsFolderPath, { recursive: true });
    }
}


const build = (nodeVersion, platform, architecture) => {
    try {
        console.log('Cleaning previous builds: Started');

        if (fs.existsSync('temp')) {
            fs.rmSync('temp', { recursive: true, force: true });
        }

        if (fs.existsSync('dist')) {
            fs.rmSync('dist', { recursive: true, force: true });
        }
        if (fs.existsSync('build.log')) {
            fs.unlinkSync('build.log')
        }
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Cleaning previous builds: Complete');
        process.stdout.write('\n');
    } catch (error) {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Cleaning previous builds: Failed');
        process.stdout.write('\n');
        console.error("Error:", error);
        process.exit(1);
    }


    // try {
    //     console.log('Bundling: Started');
    //     execSync("ncc build index.js -o dist/bundle > build.log 2>&1", { stdio: 'inherit' });
    //     readline.cursorTo(process.stdout, 0);
    //     process.stdout.write('Bundling: Complete');
    //     process.stdout.write('\n');
    //     console.log("Bundle is in the 'dist' directory.");
    // } catch (error) {
    //     readline.cursorTo(process.stdout, 0);
    //     process.stdout.write('Bundling: Failed');
    //     process.stdout.write('\n');
    //     console.error("Error:", error);
    //     process.exit(1);
    // }

    try {
        console.log('Build: Started');
        console.log(`Build: Building nodeVersion: ${nodeVersion} platform: ${platform} architecture: ${architecture}`);

        let target = `${nodeVersion}-${platform}-${architecture}`

        execSync(`pkg . --target ${target} --debug> build.log 2>&1`, { stdio: 'inherit' });
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Build: Complete');
        process.stdout.write('\n');
        console.log("Executables are in the 'dist' directory.");
    } catch (error) {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Build: Failed');
        process.stdout.write('\n');
        console.error("Error:", error);
        process.exit(1);
    }


    try {
        const sourcePath = path.join('dist', platform === 'win' ? 'cli.exe' : 'cli');
        // let _distFolder = platform === 'win' ? '../../builds' : '/usr/local/bin'
        let _distFolder = '../../builds'
        if (platform === 'win') {
            _ensureDir(_distFolder)
        }
        const destinationPath = path.join(_distFolder, platform === 'win' ? 'oa.exe' : 'oa');
        // const destinationPath = path.join(_distFolder, 'oa.exe');
        console.log('Copying: Started');
        fs.copyFileSync(sourcePath, destinationPath)
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Copying: Complete');
        process.stdout.write('\n');
        console.log(`Build is copied to '${destinationPath}'`);
    } catch (error) {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Build: Failed');
        process.stdout.write('\n');
        console.error("Error:", error);
        process.exit(1);
    }
}

let platform = _getValue('platform') || _platform;

if (platform === 'all') {
    for (const platform of ['win', 'macos', 'linux']) {
        build(
            _getValue('nodeVersion') || _nodeVersion,
            platform,
            _getValue('architecture') || _architecture
        )
    }
} else {
    build(
        _getValue('nodeVersion') || _nodeVersion,
        platform,
        _getValue('architecture') || _architecture
    )
}

