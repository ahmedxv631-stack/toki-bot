export default {
  async fetch(request, env) {
    const TARGET_HOST = "http://45.89.126.222:25583";
    const incomingUrl = new URL(request.url);

    // نبني الرابط الجديد مع الحفاظ على المسار والـ query
    const targetUrl = new URL(
      incomingUrl.pathname + incomingUrl.search,
      TARGET_HOST
    );

    try {
      const newHeaders = new Headers();
      const allowedHeaders = [
        "user-agent",
        "accept",
        "accept-language",
        "referer",
        "cookie",
        "authorization",
        "content-type",
      ];

      allowedHeaders.forEach((h) => {
        const val = request.headers.get(h);
        if (val) newHeaders.set(h, val);
      });

      // نخلي الـ Host يطابق السيرفر الأصلي
      newHeaders.set("host", "toby.hidencloud.com");

      if (!newHeaders.has("user-agent")) {
        newHeaders.set(
          "user-agent",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        );
      }

      let body = null;
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        body = await request.arrayBuffer();
      }

      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: body,
        redirect: "manual", // مهم عشان redirects تفضل على دومينك
      });

      // لو السيرفر عمل redirect، نرجعه للمستخدم على الدومين الجديد
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          const redirectUrl = new URL(location);
          const fixedHeaders = new Headers(response.headers);
          fixedHeaders.set(
            "location",
            incomingUrl.origin + redirectUrl.pathname + redirectUrl.search
          );
          fixedHeaders.set("Access-Control-Allow-Origin", "*");
          return new Response(null, {
            status: response.status,
            headers: fixedHeaders,
          });
        }
      }

      const finalHeaders = new Headers(response.headers);
      finalHeaders.set("Access-Control-Allow-Origin", "*");
      // شيل أي headers بتكسر الدومين الجديد
      finalHeaders.delete("content-security-policy");
      finalHeaders.delete("content-encoding");

      return new Response(response.body, {
        status: response.status,
        headers: finalHeaders,
      });
    } catch (error) {
      return new Response("Proxy Error: " + error.message, { status: 500 });
    }
  },
};