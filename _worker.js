export default {
  async fetch(request, env) {
    // استبدل الـ IP ده بدومين السيرفر الفعلي لو متاح (مثل: proxy.yourdomain.com)
    // لو هتستخدم IP مباشر، تأكد إن السيرفر بيقبل الاتصال من Cloudflare
    const TARGET_HOST = "45.89.126.222:25583"; 
    const incomingUrl = new URL(request.url);

    // بناء الرابط المستهدف
    const targetUrl = new URL(
      incomingUrl.pathname + incomingUrl.search,
      `http://${TARGET_HOST}`
    );

    try {
      const newHeaders = new Headers();

      // نقل الـ headers الأساسية بأمان
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

      // ضبط الـ Host header ليطابق السيرفر المستهدف لمنع خطأ 1003
      newHeaders.set("host", TARGET_HOST);

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

      // تنفيذ الطلب للسيرفر الخارجي مع تعطيل الـ redirect التلقائي للتحكم فيه
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body,
        redirect: "manual",
      });

      // معالجة الـ Redirects لو حصلت
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          const redirectUrl = new URL(location, `http://${TARGET_HOST}`);
          const fixedHeaders = new Headers(response.headers);

          fixedHeaders.set(
            "location",
            incomingUrl.origin +
              redirectUrl.pathname +
              redirectUrl.search
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

      // إزالة الـ headers اللي ممكن تسبب تعارض مع Cloudflare
      finalHeaders.delete("content-security-policy");
      finalHeaders.delete("content-encoding");

      return new Response(response.body, {
        status: response.status,
        headers: finalHeaders,
      });

    } catch (error) {
      return new Response(
        "Proxy Error: " + error.message,
        { status: 500 }
      );
    }
  },
};
