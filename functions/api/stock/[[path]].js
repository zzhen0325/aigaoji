import { proxyRequest } from "../../_utils/proxy.js";

export const onRequest = ({ request }) => {
  return proxyRequest(request, {
    baseOrigin: "http://hq.sinajs.cn",
    basePath: "/api/stock",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://finance.sina.com.cn/",
      "Accept": "*/*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Connection": "keep-alive"
    }
  });
};
