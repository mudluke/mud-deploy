import { ethers } from 'ethers';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';
import fs from 'fs/promises';

function checkAddress(address) {
  // 去掉0x前缀,只看地址本身
  const addr = address.slice(2).toLowerCase();

  // 检查第一位和后面连续6位是否相同
  const firstChar = addr[0];

  for (let i = 1; i <= 5; i++) {
    if (addr[i] !== firstChar) {
      return false;
    }
  }
  return true;
}

function formatDate(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function searchInWorker() {
  while (true) {
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;

    if (checkAddress(address)) {
      parentPort.postMessage({
        address: address,
        privateKey: wallet.privateKey.slice(2), // 移除0x前缀
        timestamp: new Date(),
      });
    }
  }
}

if (isMainThread) {
  // 主线程
  const numCPUs = os.cpus().length; // 获取CPU核心数
  console.log(`启动 ${numCPUs} 个工作线程进行搜索...`);

  // 创建工作线程
  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(new URL(import.meta.url));

    worker.on('message', async (result) => {
      const line = `${formatDate(result.timestamp)} : ${result.address} : ${result.privateKey}\n`;
      // 输出到控制台
      process.stdout.write(line);
      await fs.appendFile('pks.txt', line);
    });

    worker.on('error', (error) => {
      console.error('工作线程错误:', error);
    });
  }
} else {
  // 工作线程
  searchInWorker();
}
