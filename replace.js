import fs from 'fs-extra';
import { ethers } from 'ethers';

async function main1() {
  // 读取balances.json文件
  const balances = await fs.readJson('balances-readable.json');

  // 一次性读取replace.txt
  const content = await fs.readFile('replace.txt', 'utf8');
  const lines = content.split('\n');

  let addresses = [];
  let duplicate = {};

  // 处理每一行
  for (const line of lines) {
    // 处理地址行
    if (line.startsWith('0x')) {
      addresses.push(line);
    }

    if (line == '') {
      const targetAddress = addresses[addresses.length - 1];
      for (const address of addresses.slice(0, -1)) {
        if (duplicate[address]) {
          console.log('重复地址', address);
          continue;
        }
        duplicate[address] = true;
        // console.log('替换地址', address);
        let find = false;
        for (let i = 0; i < balances.length; i++) {
          if (balances[i].address.toLowerCase() == address.toLowerCase()) {
            balances[i].distribute = [
              {
                address: targetAddress.toLowerCase(),
                amount: balances[i].amount,
              },
            ];
            balances[i].remark = '这是替换的私钥地址';
            find = true;
            break;
          }
        }
        if (!find) {
          // console.log('未找到地址', address);
        } else {
          // console.log('替换地址-->', address);
        }
      }
      // console.log(addresses);
      addresses = [];
    }
  }

  // 写入新文件
  await fs.writeJson('balances-replaced.json', balances, { spaces: 2 });
  console.log('替换完成');
}

async function main2() {
  const items = await fs.readJson('./balances-replaced.json');
  const balancesObject = {};
  const balances = [];
  let totalBalance = 0n;
  let originTotalBalance = 0n;

  const dealBalance = (item) => {
    const address = item.address.toLowerCase();
    const amount = ethers.parseEther(item.amount);

    if (balancesObject[address]) {
      console.log(`${address} already exists`, item.amount, ethers.formatEther(balancesObject[address]));
      balancesObject[address] += amount;
    } else {
      balancesObject[address] = amount;
    }

    totalBalance += amount;
  };

  for (const item of items) {
    const { address, amount, distribute } = item;
    originTotalBalance += ethers.parseEther(amount);
    if (Array.isArray(distribute)) {
      for (const d of distribute) {
        const { address, amount } = d;
        dealBalance({ address, amount });
      }
    } else {
      dealBalance({ address, amount });
    }
  }
  for (const address in balancesObject) {
    balances.push({ address, amount: ethers.formatEther(balancesObject[address]) });
  }

  console.log(`origin users: ${items.length}, final users: ${balances.length}`);
  console.log(`origin total balance: ${ethers.formatEther(originTotalBalance)}, final total balance: ${ethers.formatEther(totalBalance)}`);
  balances.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
  await fs.writeJson('./balances.json', balances, { spaces: 2 });
}

async function main() {
  await main1();
  await main2();
}

main();
