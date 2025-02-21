import axios from 'axios';
import { ethers } from 'ethers';
import fs from 'fs-extra';
const API_KEY = 'd6e66291-8dbc-45af-90d6-61742b520eb8';
const API_URL = 'https://www.oklink.com/api/v5/explorer/token/position-list';

const params = {
  chainShortName: 'polygon',
  tokenContractAddress: '0xf6eac236757e82d6772e8bd02d36a0c791d78c51',
  limit: 100, // 每页最大数量
};
const totalPage = 100;

const contracts = [
  '0x35e53d176723b7516c559634181bcead354c93f1',
  '0xf628f33a9174dde7100249a84800ee849139b1a2',
  '0x23fa4b73f80fbb1563792662c434d307bf49b224',
  '0xf1ff4342ecd100213ab3fbbdbc13ef84c77ef38a',
  '0xb78d353042596448ef067dad0f92eaa9373fda7d',
  '0x5338968f9646e4a865d76e07c2a6e340dd3ac462',
  '0x1b933598d91c104fdab8826cc5c944c81fb4a67d',
  '0x23b5aa437cfdaf03235d78961e032dba549dfc06',
  '0xf6eac236757e82d6772e8bd02d36a0c791d78c51',
  '0x07964f135f276412b3182a3b2407b8dd45000000',
  '0xb01f8f528702d411d24c9bb8cc0e2fff779ec013',
  '0x1111111254eeb25477b68fb85ed929f73a960582',
  '0xd4a89a316c603f85d130b2b630b0fe57873fede1',
  '0x580a6101e0d1808dbb4ff640d53b6f7104084982',
  '0xd1b47490209ccb7a806e8a45d9479490c040abf4',
];

const main1 = async () => {
  let allHolders = [];
  try {
    for (let page = 1; page <= totalPage; page++) {
      const response = await axios.get(API_URL, {
        params: { ...params, page },
        headers: { 'Ok-Access-Key': API_KEY },
      });

      if (response.data.code !== '0') {
        throw new Error(`API Error: ${response.data.msg}`);
      }

      const { positionList, totalPage } = response.data.data[0];
      for (const item of positionList) {
        allHolders.push({
          address: item.holderAddress,
          amount: item.amount,
          contract: contracts.find((c) => c.toLowerCase() === item.holderAddress.toLowerCase()) === undefined ? undefined : true,
        });
      }

      console.log(`Fetched page ${page}/${totalPage}`);
    }

    return allHolders;
  } catch (error) {
    console.error('Error:', error.message);
  }
  fs.writeFileSync('./balances-origin.json', JSON.stringify(allHolders, null, 2));
};

async function main2() {
  const holders = await fs.readJson('./balances-origin.json');
  const holdersObject = {};
  let totalBalance = 0n;
  for (const holder of holders) {
    const address = holder.address.toLowerCase();
    const amount = ethers.parseEther(holder.amount);
    if (holdersObject[address]) {
      console.log(`${address} already exists`, holder.amount, ethers.formatEther(holdersObject[address].amount));
    } else {
      holdersObject[address] = { address, amount };
      if (holder.contract) {
        holdersObject[address].contract = true;
      }
      totalBalance += amount;
    }
  }

  const balances = [];
  for (const address in holdersObject) {
    let amount = ethers.formatEther(holdersObject[address].amount);
    if (amount.endsWith('.0')) {
      amount = amount.slice(0, -2);
    }
    balances.push({ address, amount, contract: holdersObject[address].contract });
  }
  console.log(`total balance: ${ethers.formatEther(totalBalance)}, total holders: ${balances.length}`);
  balances.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
  fs.writeFileSync('./balances-origin.json', JSON.stringify(balances, null, 2));
}

async function main3() {
  const items = await fs.readJson('./balances-readable.json');
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

main2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
