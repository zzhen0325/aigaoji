const axios = require('axios');
async function check(code) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
    const res = await axios.get(url);
    const script = res.data;
    const contentMatch = script.match(/content:"(.*?)"/);
    if (contentMatch) {
        console.log(`[${code}] Content sample:`);
        console.log(contentMatch[1].substring(0, 500)); 
    }
  } catch(e) { console.log(e); }
}
check('025500');
