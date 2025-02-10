import axios from 'axios';
import fs from 'fs';
const API_KEY = 'd6e66291-8dbc-45af-90d6-61742b520eb';
const API_URL = 'https://www.oklink.com/api/v5/explorer/token/position-list';

const params = {
  chainShortName: 'polygon',
  tokenContractAddress: '0xf6eac236757e82d6772e8bd02d36a0c791d78c51',
  limit: 100, // 每页最大数量
};
const totalPage = 100;

const fetchAllHolders = async () => {
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
          rank: item.rank,
        });
      }

      console.log(`Fetched page ${page}/${totalPage}`);
    }

    return allHolders;
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// 执行查询
fetchAllHolders().then((holders) => {
  fs.writeFileSync('./holders.json', JSON.stringify(holders, null, 2));
});
