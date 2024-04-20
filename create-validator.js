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

    const privateKey = '54a2d3ac86cd0ce2c3af91a930d9a77199c658edf9af8341991e3622f2d9b521';
    const wallet = new ethers.Wallet(privateKey, provider);
    const description = ['join node', 'identity', 'http://cosmos.lucq.fun', 'security contract', 'It is my details'];
    const commission = ['100000000000000000', '100000000000000000', '100000000000000000'];
    const minSelfDelegation = '1';
    const pubkey = key;
    const value = '100000000000000000000';

    const stakingAddress = '0x0000000000000000000000000000000000001003';
    const abi = [
      {
        inputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'moniker',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'identity',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'website',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'securityContact',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'details',
                type: 'string',
              },
            ],
            internalType: 'struct Description',
            name: 'description',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'rate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'maxRate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'maxChangeRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct CommissionRates',
            name: 'commission',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'minSelfDelegation',
            type: 'uint256',
          },
          {
            internalType: 'string',
            name: 'pubkey',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'createValidator',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
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
