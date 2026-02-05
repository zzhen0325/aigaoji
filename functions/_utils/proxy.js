import { jsonResponse } from "./json.js";

export const proxyRequest = async (request, options) => {
  const { baseOrigin, basePath, headers, cacheControl, addCors, defaultContentType } = options;
  try {
    const url = new URL(request.url);
    let subPath = url.searchParams.get("path");
    if (!subPath && url.pathname.startsWith(basePath)) {
      subPath = url.pathname.slice(basePath.length);
    }
    if (!subPath) {
      subPath = "/";
    }
    if (!subPath.startsWith("/")) {
      subPath = `/${subPath}`;
    }
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("path");
    const queryString = searchParams.toString();
    const targetUrl = `${baseOrigin}${subPath}${queryString ? `?${queryString}` : ""}`;
    const forwardHeaders = new Headers(headers || {});
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body
    });
    const responseHeaders = new Headers(upstream.headers);
    if (cacheControl) {
      responseHeaders.set("Cache-Control", cacheControl);
    }
    if (addCors) {
      responseHeaders.set("Access-Control-Allow-Origin", "*");
    }
    if (defaultContentType && !responseHeaders.get("Content-Type")) {
      responseHeaders.set("Content-Type", defaultContentType);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (error) {
    return jsonResponse({ error: "Proxy error", message: error?.message || String(error) }, { status: 500 });
  }
};
