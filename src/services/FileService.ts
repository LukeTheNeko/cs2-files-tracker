// services/FileService.ts
import fs from 'fs';
import path from 'path';
import * as parser from '@node-steam/vdf';
import { vpkFiles } from '../constants/constants';

const dir = path.resolve('./public/static');

export function trimBOM(buffer: Buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return buffer.slice(3);
    } else {
        return buffer;
    }
}

export function extractVPKFiles(vpkDir: any) {
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
                const fileName = filepath[filepath.length - 1].replace('.txt', '');

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
