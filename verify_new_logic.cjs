const axios = require('axios');

async function check(code) {
  try {
    console.log(`Checking ${code}...`);
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
    const res = await axios.get(url);
    const script = res.data;
    const contentMatch = script.match(/content:"(.*?)"/);
    
    if (contentMatch) {
       const html = contentMatch[1];
       const rows = html.split('</tr>');
       let count = 0;
       rows.forEach(row => {
          const linkMatch = row.match(/href='[^']*\/\/quote\.eastmoney\.com\/(?:([a-z]+)\/)?([a-z]*)(\d+)\.html'/);
          const weightMatch = row.match(/<td>([\d\.]+)%<\/td>/);
          if (linkMatch && weightMatch) {
              const market = linkMatch[2] || linkMatch[1];
              const code = linkMatch[3];
              const weight = weightMatch[1];
              console.log(`  Stock: ${market ? market : ''}${code}, Weight: ${weight}%`);
              count++;
          }
       });
       console.log(`Found ${count} holdings.`);
    } else {
       console.log('No content match.');
    }
  } catch(e) { console.log(e.message); }
}

(async () => {
  await check('025500');
  await check('002112');
})();
