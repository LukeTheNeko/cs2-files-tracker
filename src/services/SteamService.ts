import SteamUser from 'steam-user';
import fs from 'fs';
import path from 'path';
import { downloadVPKDir, downloadVPKArchives } from './VPKService';
import { extractVPKFiles } from './FileService';

export interface CustomSteamUser extends SteamUser {
    downloadFile(appId: number, depotId: number, file: any, filePath: string): Promise<void>;
    getManifest(appId: number, depotId: number, manifestId: string, access: string): Promise<any>;
}

export class SteamService {
    private appId = 730;
    private depotId = 2347770;
    private user: CustomSteamUser;
    private manifestIdFile: string;

    constructor() {
        this.user = new SteamUser() as CustomSteamUser;
        this.manifestIdFile = path.resolve('./public/static/manifestId.txt');
    }

    async login(username: string, password: string) {
        console.log('Logging into Steam...');
        this.user.logOn({
            accountName: username,
            password: password,
            logonID: 2121,
        });

        return new Promise<void>((resolve, reject) => {
            this.user.once('loggedOn', () => resolve());
            this.user.once('error', (err) => reject(err));
        });
    }

    async processFiles(): Promise<string> {
        try {
            const cs = (await this.user.getProductInfo([this.appId], [], true)).apps[this.appId].appinfo;
            const commonDepot = cs.depots[this.depotId];
            const latestManifestId = commonDepot.manifests.public.gid;

            console.log(`Obtained latest manifest ID: ${latestManifestId}`);

            let existingManifestId = '';
            try {
                existingManifestId = fs.readFileSync(this.manifestIdFile, 'utf-8');
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw err;
                }
            }

            if (existingManifestId === latestManifestId) {
                console.log('Latest manifest ID matches existing manifest ID, exiting.');
                return latestManifestId;
            }

            console.log('Latest manifest ID does not match existing manifest ID, downloading game files...');

            const manifest = await this.user.getManifest(
                this.appId,
                this.depotId,
                latestManifestId,
                'public'
            );

            const vpkDir = await downloadVPKDir(this.user, manifest);
            await downloadVPKArchives(this.user, manifest, vpkDir);
            extractVPKFiles(vpkDir);

            return latestManifestId;
        } catch (err) {
            console.error('Error during processing:', err);
            throw err;
        }
    }
}
