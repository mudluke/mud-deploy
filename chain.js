import { ethers } from 'ethers';
import fs from 'fs-extra';

async function main() {
  const holders = await fs.readJson('./balances.json');
  const genesis = [];
  for (const holder of holders) {
    const address = holder.address.toLowerCase();
    const amount = ethers.parseEther(holder.amount);
    genesis.push({ address, balance: amount.toString() });
  }

  fs.writeFileSync('./chain.json', JSON.stringify({ genesis }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
