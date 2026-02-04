const axios = require('axios');
async function check(code) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
    const res = await axios.get(url);
    const script = res.data;
    const contentMatch = script.match(/content:"(.*?)"/);
    if (contentMatch) {
        const html = contentMatch[1];
        const tbodyIndex = html.indexOf('<tbody>');
        if (tbodyIndex !== -1) {
            console.log(html.substring(tbodyIndex, tbodyIndex + 500));
        } else {
            console.log('No tbody found');
            // Maybe it says "暂无数据"
            if (html.includes('暂无数据')) console.log('暂无数据');
        }
    }
  } catch(e) { console.log(e); }
}
check('025500');
