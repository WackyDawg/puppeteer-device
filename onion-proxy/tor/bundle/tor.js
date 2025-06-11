const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const EventEmitter = require('events');

const PLATFORM = os.platform().toLowerCase();

const LINUX_PATH = path.join(__dirname, './linux/tor/tor');
const WINDOWS_PATH = path.join(__dirname, './windows/tor/tor.exe');

module.exports = class TorRunner extends EventEmitter {
    name = 'tor';

    _worker = null;
    _filePath = null;
    _initialized = false;

    constructor() {
        super();
        this._init();
    }

    _init() {
        if (PLATFORM === 'linux') {
            this._loadLinux();
        } else if (PLATFORM === 'win32') {
            this._loadWindows();
        } else {
            throw new Error('Unsupported platform: ' + PLATFORM);
        }

        this._initialized = true;
    }

    _loadLinux() {
        // fs.chmodSync(LINUX_PATH, 0o754);
        this._filePath = LINUX_PATH;
    }

    _loadWindows() {
        this._filePath = WINDOWS_PATH;
    }

    start() {
        if (this._worker) {
            console.log('Tor is already running.');
            return;
        }

        console.log('Starting Tor from:', this._filePath);

        this._worker = spawn(this._filePath, []);

        this._worker.stdout.on('data', data => {
            const text = data.toString();
            console.log(text);

            if (text.includes('Bootstrapped 100%')) {
                console.log('Tor is ready.');
                this.emit('ready');
            }
        });

        this._worker.stderr.on('data', data => {
            console.error('Tor error:', data.toString());
        });

        this._worker.on('exit', code => {
            console.log('Tor process exited with code:', code);
            this._worker = null;
        });
    }

    stop() {
        if (this._worker) {
            this._worker.kill();
            this._worker = null;
            console.log('Tor has been stopped.');
        }
    }
};
