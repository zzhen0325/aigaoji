import { proxyRequest } from "../../_utils/proxy.js";

export const onRequest = ({ request }) => {
  return proxyRequest(request, {
    baseOrigin: "https://fundmobapi.eastmoney.com",
    basePath: "/api/fund-holdings",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
      "Referer": "https://fund.eastmoney.com/",
      "Accept": "*/*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Connection": "keep-alive"
    }
  });
};
