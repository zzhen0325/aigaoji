import { proxyRequest } from "../../_utils/proxy.js";

export const onRequest = ({ request }) => {
  return proxyRequest(request, {
    baseOrigin: "https://fund.eastmoney.com",
    basePath: "/api/fund",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://fund.eastmoney.com/",
      "Accept": "*/*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Connection": "keep-alive"
    },
    cacheControl: "s-maxage=600, stale-while-revalidate=300"
  });
};
