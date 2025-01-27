import SteamUser from 'steam-user';
import fs from 'fs';
import path from 'path';
import vpk from 'vpk';
import * as parser from '@node-steam/vdf';

const appId = 730;
const depotId = 2347770;
const dir = path.resolve('./public/static');
const temp = './temp';
const manifestIdFile = path.join(dir, 'manifestId.txt');

const vpkFiles = [
    'resource/csgo_brazilian.txt',
    'resource/csgo_bulgarian.txt',
    'resource/csgo_czech.txt',
    'resource/csgo_danish.txt',
    'resource/csgo_dutch.txt',
    'resource/csgo_english.txt',
    'resource/csgo_finnish.txt',
    'resource/csgo_french.txt',
    'resource/csgo_german.txt',
    'resource/csgo_greek.txt',
    'resource/csgo_hungarian.txt',
    'resource/csgo_italian.txt',
    'resource/csgo_indonesian.txt',
    'resource/csgo_japanese.txt',
    'resource/csgo_koreana.txt',
    'resource/csgo_latam.txt',
    'resource/csgo_norwegian.txt',
    'resource/csgo_polish.txt',
    'resource/csgo_portuguese.txt',
    'resource/csgo_romanian.txt',
    'resource/csgo_russian.txt',
    'resource/csgo_schinese.txt',
    'resource/csgo_schinese_pw.txt',
    'resource/csgo_spanish.txt',
    'resource/csgo_swedish.txt',
    'resource/csgo_tchinese.txt',
    'resource/csgo_thai.txt',
    'resource/csgo_turkish.txt',
    'resource/csgo_ukrainian.txt',
    'resource/csgo_vietnamese.txt',
    'scripts/items/items_game.txt',
];

interface CustomSteamUser extends SteamUser {
    downloadFile(appId: number, depotId: number, file: any, filePath: string): Promise<void>;
    getManifest(appId: number, depotId: number, manifestId: string, access: string): Promise<any>;
}

async function downloadVPKDir(user: CustomSteamUser, manifest: any) {
    const dirFile = manifest.manifest.files.find((file: any) =>
        file.filename.endsWith('csgo\\pak01_dir.vpk')
    );

    console.log(`Downloading vpk dir`);

    await user.downloadFile(appId, depotId, dirFile, `${temp}/pak01_dir.vpk`);

    const vpkDir = new vpk(`${temp}/pak01_dir.vpk`);
    vpkDir.load();

    return vpkDir;
}

function getRequiredVPKFiles(vpkDir: any) {
    const requiredIndices: number[] = [];

    for (const fileName of vpkDir.files) {
        for (const f of vpkFiles) {
            if (fileName.startsWith(f)) {
                console.log(`Found vpk for ${f}: ${fileName}`);

                const archiveIndex = vpkDir.tree[fileName].archiveIndex;

                if (!requiredIndices.includes(archiveIndex)) {
                    requiredIndices.push(archiveIndex);
                }

                break;
            }
        }
    }

    return requiredIndices.sort();
}

async function downloadVPKArchives(user: CustomSteamUser, manifest: any, vpkDir: any) {
    const requiredIndices = getRequiredVPKFiles(vpkDir);

    console.log(`Required VPK files ${requiredIndices}`);

    for (let index in requiredIndices) {
        const archiveIndex = requiredIndices[index];
        const paddedIndex =
            '0'.repeat(3 - archiveIndex.toString().length) + archiveIndex;
        const fileName = `pak01_${paddedIndex}.vpk`;

        const file = manifest.manifest.files.find((f: any) =>
            f.filename.endsWith(fileName)
        );
        const filePath = path.join(temp, fileName);

        const status = `[${parseInt(index) + 1}/${requiredIndices.length}]`;

        console.log(`${status} Downloading ${fileName}`);

        await user.downloadFile(appId, depotId, file, filePath);
    }
}

function trimBOM(buffer: Buffer) {
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xef &&
        buffer[1] === 0xbb &&
        buffer[2] === 0xbf
    ) {
        return buffer.slice(3);
    } else {
        return buffer;
    }
}

function extractVPKFiles(vpkDir: any) {
    console.log('Extracting vpk files');

    if (typeof parser.parse !== 'function') {
        throw new Error('parser.parse is not a function');
    }

    for (const f of vpkFiles) {
        let found = false;
        for (const filePath of vpkDir.files) {
            if (filePath.startsWith(f)) {
                let file = vpkDir.getFile(filePath);
                const filepath = f.split('/');
                const fileName = filepath[filepath.length - 1].replace(
                    '.txt',
                    ''
                );

                file = trimBOM(file);
                file = file.toString('utf-8');

                const parsedData = parser.parse(file);

                try {
                    fs.writeFileSync(
                        path.join(dir, `${fileName}.json`),
                        JSON.stringify(parsedData, null, 4)
                    );
                } catch (err) {
                    throw err;
                }

                found = true;
                break;
            }
        }

        if (!found) {
            throw `could not find ${f}`;
        }
    }
}

if (process.argv.length != 4) {
    console.error(
        `Missing input arguments, expected 4 got ${process.argv.length}`
    );
    process.exit(1);
}

const directories = [dir, temp];

directories.forEach(directory => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
});

const user = new SteamUser() as CustomSteamUser;

console.log('Logging into Steam...');

user.logOn({
    accountName: process.argv[2],
    password: process.argv[3],
    logonID: 2121,
});

user.once('loggedOn', async () => {
    try {
        const cs = (await user.getProductInfo([appId], [], true)).apps[appId]
            .appinfo;
        const commonDepot = cs.depots[depotId];
        const latestManifestId = commonDepot.manifests.public.gid;

        console.log(`Obtained latest manifest ID: ${latestManifestId}`);

        let existingManifestId = '';

        try {
            existingManifestId = fs.readFileSync(manifestIdFile, 'utf-8');
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code != 'ENOENT') {
                throw err;
            }
        }

        if (existingManifestId == latestManifestId) {
            console.log('Latest manifest Id matches existing manifest Id, exiting');
            process.exit(0);
        }

        console.log('Latest manifest Id does not match existing manifest Id, downloading game files');

        const manifest = await user.getManifest(
            appId,
            depotId,
            latestManifestId,
            'public'
        );

        const vpkDir = await downloadVPKDir(user, manifest);
        await downloadVPKArchives(user, manifest, vpkDir);
        extractVPKFiles(vpkDir);

        try {
            fs.writeFileSync(manifestIdFile, latestManifestId);
        } catch (err) {
            throw err;
        }

        process.exit(0);
    } catch (err) {
        console.error('Error during processing:', err);
        process.exit(1);
    }
});