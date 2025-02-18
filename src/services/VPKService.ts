import vpk from 'vpk';
import { vpkFiles } from '../constants/constants';
import { CustomSteamUser } from './SteamService';
import path from 'path';

const appId = 730;
const depotId = 2347770;
const temp = './temp';

export async function downloadVPKDir(user: CustomSteamUser, manifest: any) {
    const dirFile = manifest.manifest.files.find((file: any) =>
        file.filename.endsWith('csgo\\pak01_dir.vpk')
    );

    console.log(`Downloading vpk dir`);
    await user.downloadFile(appId, depotId, dirFile, `${temp}/pak01_dir.vpk`);

    const vpkDir = new vpk(`${temp}/pak01_dir.vpk`);
    vpkDir.load();

    return vpkDir;
}

export function getRequiredVPKFiles(vpkDir: any) {
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

export async function downloadVPKArchives(user: CustomSteamUser, manifest: any, vpkDir: any) {
    const requiredIndices = getRequiredVPKFiles(vpkDir);

    console.log(`Required VPK files ${requiredIndices}`);

    for (let index in requiredIndices) {
        const archiveIndex = requiredIndices[index];
        const paddedIndex = '0'.repeat(3 - archiveIndex.toString().length) + archiveIndex;
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