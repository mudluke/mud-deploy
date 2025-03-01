import { ethers } from 'ethers';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execPromis = util.promisify(exec);
const platform = process.platform;
const curDir = process.cwd();

export const main = async () => {
  try {
    if (!fs.existsSync('./config.json')) {
      console.log(`config.json file does not exist`);
    }

    let config = await fs.readJson('./config.json');
    let { dataDir, app } = config;
    if (!dataDir) {
      dataDir = path.join(os.homedir(), 'chain-data');
    }

    let key = '';
    {
      const chainName = app.chain_name;
      const daemonApp = platform == 'win32' ? `${app.chain_name}d.exe` : `${app.chain_name}d`;

      if (!fs.existsSync(daemonApp)) {
        console.log(`${daemonApp} executable file does not exist`);
        return;
      }

      const showValidator = `${platform !== 'win32' ? './' : ''}${daemonApp} tendermint show-validator --home ${path.join(dataDir, chainName)}`;
      console.log(`Exec cmd: ${showValidator}`);
      const { stdout } = await execPromis(showValidator, { cwd: curDir });
      let data = JSON.parse(stdout);
      console.log(`${stdout}${data.key.length}\n`);
      key = data.key;
    }

    const rpc = 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpc);

    // input params

    const [name, privateKey] = fs.readFileSync('node').toString().split(' ');
    if (!name || !privateKey) {
      console.log('node file is not found');
      return;
    }
    const wallet = new ethers.Wallet(privateKey, provider);
    const description = [name, '', 'https://mud.network', '', ''];
    const commission = ['100000000000000000', '200000000000000000', '100000000000000000'];
    const minSelfDelegation = '1';
    const pubkey = key;
    const value = '100000000000000000000';

    const stakingAddress = '0x0000000000000000000000000000000000001003';
    const abi = [
      'function createValidator((string,string,string,string,string) description, (uint256,uint256,uint256) commission, uint256 minSelfDelegation, string pubkey, uint256 value) returns (bool success)',
    ];
    const staking = new ethers.Contract(stakingAddress, abi, wallet);
    const tx = await staking.createValidator(description, commission, minSelfDelegation, pubkey, value);
    const receipt = await tx.wait();
    console.log('create validator success, receipt: ', receipt);
  } catch (error) {
    console.log('error', error);
  }
};

main();
