const axios = require('axios');
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://fundf10.eastmoney.com/'
};
async function check(code) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
    const res = await axios.get(url, { headers });
    console.log(`[${code}] Length: ${res.data.length}`);
    console.log(res.data.substring(0, 100));
    // Check if it contains stock data
    if (res.data.includes('<tbody>')) {
       console.log('Contains table data.');
    }
  } catch(e) { console.log(e.message); }
}
(async () => {
  await check('000001');
  await check('025500');
  await check('002112');
})();
