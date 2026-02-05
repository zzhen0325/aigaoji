const axios = require('axios');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Referer': 'https://fund.eastmoney.com/'
};

async function check(code) {
  console.log(`\nChecking ${code}...`);
  
  // URL 1: Current
  try {
    const u1 = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=${code}&PLATFORM=12&DEVICEID=1`;
    const r1 = await axios.get(u1, { headers });
    console.log('URL 1 (MN):', r1.data.Datas ? r1.data.Datas.length : 'None');
  } catch(e) { console.log('URL 1 Error:', e.message); }

  // URL 2: Without MN (Old API)
  try {
    const u2 = `https://fundmobapi.eastmoney.com/FundMApi/FundInverstPosition.ashx?FCODE=${code}&deviceid=1&plat=Iphone&product=EFund&version=11.0.0`;
    const r2 = await axios.get(u2, { headers });
    console.log('URL 2 (Old):', r2.data.Datas ? r2.data.Datas.length : 'None');
  } catch(e) { console.log('URL 2 Error:', e.message); }
  
  // URL 3: PC API (JSONP usually, but let's try)
  // http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=000001&topline=10&year=&month=&rt=0.88798
  // Returns HTML. Skip for now unless necessary.
}

(async () => {
  await check('025500');
  await check('002112');
  await check('000001'); // Control group
})();
