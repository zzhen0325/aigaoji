const axios = require('axios');
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://fundf10.eastmoney.com/'
};
async function check(code) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
    const res = await axios.get(url, { headers });
    const script = res.data;
    const contentMatch = script.match(/content:"(.*?)"/);
    if (contentMatch) {
        console.log(`[${code}] Content sample:`);
        console.log(contentMatch[1].substring(0, 500)); 
    }
  } catch(e) { console.log(e); }
}
check('025500');
