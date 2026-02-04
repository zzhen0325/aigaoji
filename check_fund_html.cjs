const axios = require('axios');
async function check(code) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
    const res = await axios.get(url);
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
