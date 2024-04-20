import { HDNodeWallet, Wallet } from 'ethers';
import crypto from 'crypto';
import { ethToBech32 } from '@quarix/address-converter';
import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import util from 'util';
import yargs from 'yargs';
import os from 'os';
import { hideBin } from 'yargs/helpers';

export const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

export const privKeyToBurrowAddres = (privKey, isBase64 = true) => {
  if (isBase64) {
    privKey = Buffer.from(privKey, 'base64').toString('hex');
  }
  const publicKey = privKey.substring(64, 128);
  const digest = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest('hex');
  return digest.toLowerCase().substring(0, 40);
};

let argv = yargs(hideBin(process.argv))
  .option('s', {
    alias: 'start',
    demandOption: false,
    default: false,
    describe: 'Whether after initialize immediate start',
    type: 'bool',
  })
  .boolean(['s']).argv;

const start = argv.start;
const nodesCount = 1;
const platform = process.platform;
const execPromis = util.promisify(exec);
const curDir = process.cwd();

let chainId = 'chain_88888888-1';
let clientCfg = `
# The network chain ID
chain-id = "${chainId}"
# The keyring's backend, where the keys are stored (os|file|kwallet|pass|test|memory)
keyring-backend = "test"
# CLI output format (text|json)
output = "text"
# <host>:<port> to Tendermint RPC interface for this chain
node = "tcp://localhost:26657"
# Transaction broadcasting mode (sync|async)
broadcast-mode = "sync"
`;

const updatePorts = (data, ports, index) => {
  let lines = data.split(/\r?\n/);
  for (const key in ports) {
    let [k1, k2] = key.split('.'); // key for example "api.address"
    let port = ports[key];
    let find = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      //  for example: [json-rpc]
      if (line.startsWith(`[${k1}]`)) {
        find = true;
      }
      //for example: "tcp://0.0.0.0:1317"
      if (find && line.startsWith(`${k2} = `)) {
        const oldPort = line.split(':').pop().split(`"`)[0];
        const newPort = String(port + index);
        // console.log(line, oldPort, newPort);
        lines[i] = line.replace(oldPort, newPort);
        break;
      }
    }
  }
  return lines.join('\n');
};

const updateCfg = (data, cfg) => {
  let lines = data.split(/\r?\n/);
  for (const key in cfg) {
    let find = true;
    let k1;
    let k2 = key;
    if (key.indexOf('.') > 0) {
      [k1, k2] = key.split('.');
      find = false;
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!find && line.startsWith(`[${k1}]`)) {
        find = true;
      }
      if (find && line.startsWith(`${k2} = `)) {
        lines[i] = `${k2} = ${cfg[key]}`;
        break;
      }
    }
  }
  return lines.join('\n');
};

const main = async function () {
  console.log(`start:${argv.start}\n`);

  try {
    if (!fs.existsSync('./config.json')) {
      console.log(`config.json file does not exist`);
    }

    let config = await fs.readJson('./config.json');
    let { app, tendermint, preMineAccounts, dataDir } = config;
    if (!dataDir) {
      dataDir = path.join(os.homedir(), 'chain-data');
    }

    if (app.chain_id) {
      clientCfg = clientCfg.replaceAll(chainId, app.chain_id);
      chainId = app.chain_id;
    }
    const chainName = app.chain_name;
    const daemon = `${app.chain_name}d`;
    const daemonApp = platform == 'win32' ? `${app.chain_name}d.exe` : `${app.chain_name}d`;
    const tempDir = path.join(curDir, 'nodes');

    if (!fs.existsSync(daemonApp)) {
      console.log(`${daemonApp} executable file does not exist`);
      return;
    }

    console.log('Start cleaning up folder nodes');
    await fs.remove(tempDir);
    await fs.remove(path.join(dataDir, chainName));
    console.log('Folder nodes has been cleaned up');

    {
      const initFiles = `${platform !== 'win32' ? './' : ''}${daemonApp} testnet init-files --v 1 --output-dir ./nodes --chain-id ${chainId} --keyring-backend test`;
      console.log(`Exec cmd: ${initFiles}`);
      const { stdout, stderr } = await execPromis(initFiles, { cwd: curDir });
      console.log(`${stdout}${stderr}\n`);
    }

    for (let i = 0; i < nodesCount; i++) {
      const nodeKey = await fs.readJSON(path.join(tempDir, `node${i}/${daemon}/config/node_key.json`));
      const nodeId = privKeyToBurrowAddres(nodeKey.priv_key.value);
      console.log(`====== you peer node info is ${nodeId}@YOU_IP:${tendermint.port['p2p.laddr']}, save it to peers.json for other nodes to join. ======`);

      const keySeedPath = path.join(tempDir, `node${i}/${daemon}/key_seed.json`);
      let curKeySeed = await fs.readJSON(keySeedPath);
      const wallet = HDNodeWallet.fromPhrase(curKeySeed.secret);
      curKeySeed.privateKey = wallet.privateKey.replace('0x', '');
      curKeySeed.publicKey = wallet.publicKey.replace('0x', '');
      curKeySeed.address = wallet.address;
      curKeySeed.bip39Address = ethToBech32(wallet.address, app.prefix);
      await fs.outputJson(keySeedPath, curKeySeed, { spaces: 2 });
    }

    const account = { '@type': '/ethermint.types.v1.EthAccount', base_account: { address: '', pub_key: null, account_number: '0', sequence: '0' }, code_hash: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470' };
    for (let i = 0; i < nodesCount; i++) {
      let accounts = [];
      let balances = [];
      if (Array.isArray(preMineAccounts)) {
        let duplicate = {};
        for (const ac of preMineAccounts) {
          let { address, amount } = ac;
          if (ac.length == 64) {
            const wallet = new Wallet(ac);
            address = ethToBech32(wallet.address, app.prefix);
          } else if (address.startsWith('0x')) {
            address = ethToBech32(ac, app.prefix);
          }
          if (duplicate[address]) {
            continue;
          }
          duplicate[address] = true;

          accounts.push(Object.assign(JSON.parse(JSON.stringify(account)), { base_account: { address } }));
          balances.push({ address, coins: app.denoms.map((denom) => ({ denom, amount })) });
        }
      }

      const genesisPath = path.join(tempDir, `node${i}/${daemon}/config/genesis.json`);
      let genesis = await fs.readJSON(genesisPath);
      let appState = genesis.app_state;
      appState.auth.accounts.push(...accounts);
      appState.bank.balances.push(...balances);

      const genesisCfg = config.genesisCfg;
      if (Array.isArray(genesisCfg)) {
        for (const cfg of genesisCfg) {
          eval('genesis.' + cfg);
        }
      }

      // Use zero address to occupy the first account, Because of account_ Accounts with number 0 cannot send Cosmos transactions
      appState.auth.accounts.unshift(Object.assign(JSON.parse(JSON.stringify(account)), { base_account: { address: ethToBech32('0x0000000000000000000000000000000000000000', app.prefix) } }));

      await fs.outputJson(genesisPath, genesis, { spaces: 2 });
    }

    // update app.toml and config.toml
    for (let i = 0; i < nodesCount; i++) {
      let data;
      const appConfigPath = path.join(tempDir, `node${i}/${daemon}/config/app.toml`);
      data = await fs.readFile(appConfigPath, 'utf8');
      data = updatePorts(data, app.port, i);
      data = updateCfg(data, app.cfg);
      await fs.writeFile(appConfigPath, data);

      const configPath = path.join(tempDir, `node${i}/${daemon}/config/config.toml`);
      data = await fs.readFile(configPath, 'utf8');
      data = updatePorts(data, tendermint.port, i);
      // replace persistent_peers
      // let peers = [];
      // const p2pPort = tendermint.port['p2p.laddr'];
      // for (let j = 0; j < nodesCount && nodesCount > 1; j++) {
      //   if (i != j) {
      //     peers.push(`${nodeIds[j]}@127.0.0.1:${p2pPort + j}`);
      //   }
      // }
      // tendermint.cfg['p2p.persistent_peers'] = `"${peers.join()}"`;
      data = updateCfg(data, tendermint.cfg);
      await fs.writeFile(configPath, data);

      const clientConfigPath = path.join(tempDir, `node${i}/${daemon}/config/client.toml`);
      data = clientCfg;
      data = data.replace('26657', tendermint.port['rpc.laddr'] + i + '');
      await fs.writeFile(clientConfigPath, data);
    }

    await fs.copy(path.join(tempDir, 'node0', daemon), path.join(dataDir, chainName));
    await fs.copy(path.join(curDir, daemonApp), path.join(dataDir, daemonApp));
    await fs.remove(tempDir);
    await fs.emptyDir(path.join(dataDir, chainName, 'keyring-test'));

    const startPath = path.join(dataDir, 'start.sh');
    const stopPath = path.join(dataDir, 'stop.sh');
    const startShell = `#!/bin/bash
nohup ./mudd start --home ./mud >./mud.log 2>&1 &`;
    await fs.writeFile(startPath, startShell);
    const stopShell = `#!/bin/bash
pid=\`lsof -iTCP:${tendermint.port['p2p.laddr']} -sTCP:LISTEN -t\`;
if [[ -n $pid ]]; then kill -15 $pid; fi`;
    await fs.writeFile(stopPath, stopShell);

    await fs.chmod(startPath, 0o777);
    await fs.chmod(stopPath, 0o777);

    if (start) {
      console.log(`starting the validator node`);
      await execPromis(startPath, { cwd: dataDir });
      console.log(`start node end, please use cmd:     curl http://127.0.0.1:${tendermint.port['rpc.laddr']}/block | jq     check chain status`);
    } else {
      console.log(`please go to the directory ${dataDir} and run the script ./start.sh to start the validator node.`);
    }

    console.log('\n===============================================================================');
    console.log(`please backup ${dataDir}/${chainName}/key_seed.json`);
    console.log(`please backup ${dataDir}/${chainName}/config/priv_validator_key.json`);
    console.log('===============================================================================');
  } catch (error) {
    console.log('error', error);
  }
};

main();
