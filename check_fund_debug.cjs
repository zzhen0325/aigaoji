const axios = require('axios');
const headers = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
  'Referer': 'https://fund.eastmoney.com/'
};
async function check(code) {
  try {
    const u1 = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=${code}&PLATFORM=12&DEVICEID=1`;
    const r1 = await axios.get(u1, { headers });
    console.log(`[${code}]`, JSON.stringify(r1.data).substring(0, 200));
  } catch(e) { console.log(e.message); }
}
(async () => {
  await check('000001');
})();
