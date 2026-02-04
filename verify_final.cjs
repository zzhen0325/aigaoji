const html = `<tbody><tr><td>1</td><td><a href='//quote.eastmoney.com/unify/r/1.688525'>688525</a></td><td class='tol'><a href='//quote.eastmoney.com/unify/r/1.688525'>佰维存储</a></td><td class='tor'><span data-id='dq688525'></span></td><td class='tor'><span data-id='zd688525'></span></td><td class='xglj'><a href='ccbdxq_025500_688525.html' class='red'>变动详情</a><a href='//guba.eastmoney.com/interface/GetList.aspx?code=1.688525' >股吧</a><a href='//quote.eastmoney.com/unify/r/1.688525' >行情</a></td><td class='tor'>9.50%</td></tr></tbody>`;

const rows = html.split('</tr>');
rows.forEach(row => {
    let marketPrefix = '';
    let stockCode = '';
    
    // New format
    const newFormatMatch = row.match(/href='\/\/quote\.eastmoney\.com\/unify\/r\/(\d+)\.(\w+)'/);
    if (newFormatMatch) {
        const marketId = newFormatMatch[1];
        stockCode = newFormatMatch[2];
        if (marketId === '1') marketPrefix = 'sh';
        else if (marketId === '0') marketPrefix = 'sz';
        console.log('Match New Format:', stockCode, marketId);
    }
    
    const weightMatch = row.match(/<td[^>]*>([\d\.]+)%<\/td>/);
    if (weightMatch) {
        console.log('Match Weight:', weightMatch[1]);
    } else {
        console.log('No Weight Match');
    }
});
