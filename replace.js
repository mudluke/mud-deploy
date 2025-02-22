import fs from 'fs-extra';

async function main() {
  // 读取balances.json文件
  const balances = await fs.readJson('balances.json');

  // 一次性读取replace.txt
  const content = await fs.readFile('replace.txt', 'utf8');
  const lines = content.split('\n');

  let addresses = [];

  // 处理每一行
  for (const line of lines) {
    // 处理地址行
    if (line.startsWith('0x')) {
      addresses.push(line);
    }

    if (line == '') {
      const targetAddress = addresses[addresses.length - 1];
      for (const address of addresses) {
        for (const balance of balances) {
          if (balance.address.toLowerCase() == address.toLowerCase()) {
            balance.address = targetAddress.toLowerCase();
          }
        }
      }
      console.log(addresses);
      addresses = [];
    }
  }

  // 写入新文件
  await fs.writeJson('balances-replaced.json', balances, { spaces: 2 });
  console.log('替换完成');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
