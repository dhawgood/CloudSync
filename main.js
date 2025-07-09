// main.js - Fixed and Enhanced Electron launcher
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const http = require('http'); // Added for server health checks

class CloudSyncServer {
    constructor() {
        this.serverProcess = null;
        this.serverPort = 8989; // Ensure this matches your frontend
        this.serverReady = false;
        this.rclonePath = null;
    }

    getResourcePath(relativePath) {
        return app.isPackaged
            ? path.join(process.resourcesPath, relativePath)
            : path.join(__dirname, relativePath);
    }

    getBundledRclonePath() {
        const platform = process.platform;
        const arch = process.arch;
        let rcloneSubDir;
        let rcloneExecutable = 'rclone';

        if (platform === 'darwin') {
            rcloneSubDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
        } else if (platform === 'win32') {
            rcloneSubDir = 'windows-amd64';
            rcloneExecutable = 'rclone.exe';
        } else if (platform === 'linux') {
            rcloneSubDir = 'linux-amd64';
        } else {
            console.error(`Unsupported platform: ${platform}`);
            return null;
        }

        const bundledPath = this.getResourcePath(path.join('rclone-binaries', rcloneSubDir, rcloneExecutable));
        console.log(`[Pathing] Attempting to find bundled rclone at: ${bundledPath}`);
        return bundledPath;
    }

    execPromise(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }
                if (stderr) {
                    console.log(`[Exec STDERR] for "${command}": ${stderr}`);
                }
                resolve(stdout.trim());
            });
        });
    }

    async findRclone() {
        const bundledPath = this.getBundledRclonePath();

        if (bundledPath && fs.existsSync(bundledPath)) {
            console.log('[Rclone] Found bundled binary. Verifying...');
            try {
                if (process.platform !== 'win32') {
                    fs.chmodSync(bundledPath, '755');
                }
                const version = await this.execPromise(`"${bundledPath}" version`);
                if (version.includes('rclone v')) {
                    console.log(`[Rclone] ✅ Bundled rclone is working. Path: ${bundledPath}`);
                    this.rclonePath = bundledPath;
                    return this.rclonePath;
                }
            } catch (e) {
                console.error('[Rclone] Bundled rclone found but failed to execute:', e.message);
            }
        } else {
            console.log('[Rclone] Bundled rclone not found at expected path.');
        }

        console.log('[Rclone] Falling back to system PATH to find rclone...');
        try {
            const whichCmd = process.platform === 'win32' ? 'where' : 'which';
            const systemPath = await this.execPromise(`${whichCmd} rclone`);
            const rclonePath = systemPath.split('\n')[0].trim();
            if (rclonePath) {
                console.log(`[Rclone] ✅ Found system rclone. Path: ${rclonePath}`);
                this.rclonePath = rclonePath;
                return this.rclonePath;
            }
        } catch (e) {
            console.error('[Rclone] ❌ Could not find rclone in system PATH.');
            dialog.showErrorBox('Rclone Not Found', 'The bundled rclone is missing or corrupted, and no system-wide rclone could be found in the PATH.');
            throw new Error('No working rclone installation found.');
        }
    }

    // FIXED: Replaced fetch with Node.js http module
    async checkServerHealth() {
        for (let i = 0; i < 20; i++) {
            try {
                const isHealthy = await new Promise((resolve, reject) => {
                    const req = http.get(`http://localhost:${this.serverPort}/status`, (res) => {
                        if (res.statusCode === 200) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                    
                    req.on('error', () => resolve(false));
                    req.setTimeout(1000, () => {
                        req.destroy();
                        resolve(false);
                    });
                });

                if (isHealthy) {
                    console.log('[Health Check] ✅ Server is responsive.');
                    this.serverReady = true;
                    return true;
                }
            } catch (error) {
                // Continue to next attempt
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.error('[Health Check] ❌ Server did not respond after 10 seconds.');
        return false;
    }

    async startServer() {
        try {
            await this.findRclone();
            if (!this.rclonePath) return false;

            const serverBinary = this.getResourcePath('sync-server');
            console.log(`[DEBUG] Checking for server binary at: ${serverBinary}`);
            
            if (!fs.existsSync(serverBinary)) {
                throw new Error(`Server binary not found: ${serverBinary}`);
            }

            // Check if binary is executable
            try {
                fs.accessSync(serverBinary, fs.constants.X_OK);
                console.log(`[DEBUG] Server binary is executable`);
            } catch (e) {
                console.log(`[DEBUG] Making server binary executable...`);
                fs.chmodSync(serverBinary, '755');
            }

            console.log(`[Server Start] Launching binary: ${serverBinary}`);
            console.log(`[Server Start] Passing rclone path to server: ${this.rclonePath}`);
            console.log(`[Server Start] Using port: ${this.serverPort}`);

            this.serverProcess = spawn(serverBinary, {
                detached: false,
                env: {
                    ...process.env,
                    CLOUDSYNC_RCLONE_PATH: this.rclonePath,
                    CLOUDSYNC_PORT: this.serverPort.toString()
                }
            });

            this.serverProcess.stdout.on('data', (data) => console.log(`[Python Server]: ${data.toString().trim()}`));
            this.serverProcess.stderr.on('data', (data) => console.error(`[Python Server ERR]: ${data.toString().trim()}`));
            this.serverProcess.on('exit', (code) => {
                console.log(`[Server Stop] Server process exited with code ${code}.`);
                this.serverProcess = null;
                this.serverReady = false;
            });

            // Add a small delay before health check to let server start
            console.log(`[DEBUG] Waiting 2 seconds for server to start...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return await this.checkServerHealth();

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            dialog.showErrorBox('Fatal Error', `Could not start the Python backend server. Please check the logs.\n\nError: ${error.message}`);
            return false;
        }
    }

    stopServer() {
        if (this.serverProcess) {
            console.log('[Server Stop] Terminating Python server process.');
            this.serverProcess.kill();
            this.serverProcess = null;
        }
    }
}

let mainWindow;
const cloudSyncServer = new CloudSyncServer();

function createWindow() {
    const targetHTML = app.isPackaged
        ? path.join(process.resourcesPath, 'cloudsync-control.html')
        : path.join(__dirname, 'cloudsync-control.html');

    mainWindow = new BrowserWindow({
        width: 800,
        height: 950,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'CloudSync Control'
    });

    mainWindow.loadFile(targetHTML);
}

app.whenReady().then(async () => {
    console.log('[Electron] App is ready. Initializing backend...');
    const ready = await cloudSyncServer.startServer();

    if (!ready) {
        console.error('[Startup] Server failed to start. Exiting.');
        app.quit();
        return;
    }

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    console.log('[Electron] App is quitting. Shutting down server...');
    cloudSyncServer.stopServer();
});