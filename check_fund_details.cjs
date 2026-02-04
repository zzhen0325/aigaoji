const axios = require('axios');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'http://fund.eastmoney.com/'
};

async function getFundInfo(code) {
  try {
    // 1. Search name
    const searchUrl = `http://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${code}`;
    const searchRes = await axios.get(searchUrl, { headers });
    console.log(`[Search ${code}]`, searchRes.data);

    // 2. Get Holdings
    const holdingsUrl = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=${code}&PLATFORM=12&DEVICEID=1`;
    const holdingsRes = await axios.get(holdingsUrl, { headers });
    
    if (holdingsRes.data && holdingsRes.data.Datas) {
      console.log(`[Holdings ${code}] Found ${holdingsRes.data.Datas.length} items.`);
      holdingsRes.data.Datas.forEach(h => {
        console.log(`  - ${h.GPDM} (${h.GPJC}) [${h.MARKET}] Weight: ${h.JZBL}%`);
      });
    } else {
      console.log(`[Holdings ${code}] No data found.`);
    }

  } catch (e) {
    console.error(`Error fetching ${code}:`, e.message);
  }
}

(async () => {
  await getFundInfo('025500');
  await getFundInfo('002112');
})();
