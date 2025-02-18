/**
 * This code is from csfloat and ByMykel repo. I made small changes to TS.
 * https://github.com/ByMykel/counter-strike-file-tracker
 * https://github.com/csfloat/cs-files/blob/5ff0f212ff0dc2b6f6380fc6d1a93121c2b9c2cd/index.js
 */

import { SteamService } from './services/SteamService';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('./public/static');
const temp = './temp';
const manifestIdFile = path.join(dir, 'manifestId.txt');

if (process.argv.length != 4) {
    console.error(`Missing input arguments, expected 4 got ${process.argv.length}`);
    process.exit(1);
}

const directories = [dir, temp];
directories.forEach(directory => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
});

const steamService = new SteamService();

(async () => {
    try {
        await steamService.login(process.argv[2], process.argv[3]);
        const latestManifestId = await steamService.processFiles();

        fs.writeFileSync(manifestIdFile, latestManifestId);
        console.log('Process completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error during execution:', err);
        process.exit(1);
    }
})();