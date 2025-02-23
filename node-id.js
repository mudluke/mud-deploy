import crypto from 'crypto';
import fs from 'fs-extra';
import { exec } from 'child_process';
import util from 'util';

const execPromis = util.promisify(exec);

export const privKeyToBurrowAddres = (privKey, isBase64 = true) => {
  if (isBase64) {
    privKey = Buffer.from(privKey, 'base64').toString('hex');
  }
  const publicKey = privKey.substring(64, 128);
  const digest = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest('hex');
  return digest.toLowerCase().substring(0, 40);
};

export const main = async () => {
  const ip = await execPromis('curl -4 ifconfig.me');

  const path = '/Users/lcq/Code/mud/mud/deploy/nodes/node0/mudd/config/node_key.json';
  const nodeKey = await fs.readJson(path);
  const address = privKeyToBurrowAddres(nodeKey.priv_key.value);

  console.log(`${address}@${ip.stdout}:26656`);
};

main();
