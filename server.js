const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;

const LIVE_BACKEND =
    process.env.LIVE_BACKEND ||
    "https://noon-market.onrender.com";

const ADMIN_USER =
    process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "ChangeMe123!";

const ADMIN_API_KEY =
    process.env.ADMIN_API_KEY || "";

const sessions = new Set();

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "same-origin",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization",
        "Access-Control-Allow-Methods":
            "GET,POST,PATCH,OPTIONS"
    });

    res.end(JSON.stringify(data));
}

function body(req) {
    return new Promise((resolve, reject) => {
        let data = "";

        req.on("data", chunk => {
            data += chunk;
        });

        req.on("end", () => {
            if (!data) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(data));
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
}

function token() {
    return (
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2) +
        "-" +
        Math.random().toString(36).slice(2)
    );
}

function loggedIn(req) {
    const auth =
        req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
        return false;
    }

    return sessions.has(auth.slice(7));
}

function adminHTML() {
    const file =
        path.join(__dirname, "admin.html");

    if (!fs.existsSync(file)) {
        return "<h1>admin.html not found</h1>";
    }

    return fs.readFileSync(file, "utf8");
}

function proxy(req, res) {
    if (!ADMIN_API_KEY) {
        return sendJSON(res, 500, {
            error:
                "ADMIN_API_KEY is not configured"
        });
    }

    let target;

    try {
        target =
            new URL(
                LIVE_BACKEND + req.url
            );
    } catch {
        return sendJSON(res, 500, {
            error: "Invalid live backend URL"
        });
    }

    const options = {
        protocol: target.protocol,
        hostname: target.hostname,
        port:
            target.port ||
            (target.protocol === "https:"
                ? 443
                : 80),
        path:
            target.pathname +
            target.search,
        method: req.method,
        headers: {
            "Content-Type":
                req.headers["content-type"] ||
                "application/json",
            "Accept": "application/json",
            "X-Admin-Key": ADMIN_API_KEY
        }
    };

    const transport =
        target.protocol === "https:"
            ? require("https")
            : http;

    const upstream =
        transport.request(
            options,
            upstreamRes => {
                let data = "";

                upstreamRes.on(
                    "data",
                    chunk => {
                        data += chunk;
                    }
                );

                upstreamRes.on(
                    "end",
                    () => {
                        res.writeHead(
                            upstreamRes.statusCode || 502,
                            {
                                "Content-Type":
                                    upstreamRes.headers[
                                        "content-type"
                                    ] ||
                                    "application/json; charset=utf-8",
                                "Cache-Control":
                                    "no-store",
                                "Access-Control-Allow-Origin":
                                    "same-origin"
                            }
                        );

                        res.end(data);
                    }
                );
            }
        );

    upstream.on("error", error => {
        console.error(
            "Live backend error:",
            error.message
        );

        sendJSON(res, 502, {
            error:
                "Live backend unavailable"
        });
    });

    body(req)
        .then(data => {
            if (
                req.method !== "GET" &&
                req.method !== "HEAD"
            ) {
                upstream.write(
                    JSON.stringify(data)
                );
            }

            upstream.end();
        })
        .catch(error => {
            upstream.destroy();

            sendJSON(res, 400, {
                error: error.message
            });
        });
}

const server =
    http.createServer(
        async (req, res) => {

            if (req.method === "OPTIONS") {
                res.writeHead(204);
                return res.end();
            }

            const url =
                new URL(
                    req.url,
                    "http://127.0.0.1:3001"
                );

            const p =
                url.pathname;

            try {

                if (
                    req.method === "GET" &&
                    (
                        p === "/" ||
                        p === "/admin.html"
                    )
                ) {
                    res.writeHead(200, {
                        "Content-Type":
                            "text/html; charset=utf-8",
                        "Cache-Control":
                            "no-store"
                    });

                    return res.end(
                        adminHTML()
                    );
                }

                if (
                    req.method === "POST" &&
                    p === "/api/admin/login"
                ) {
                    const data =
                        await body(req);

                    const username =
                        String(
                            data.username || ""
                        );

                    const password =
                        String(
                            data.password || ""
                        );

                    if (
                        username !==
                            ADMIN_USER ||
                        password !==
                            ADMIN_PASSWORD
                    ) {
                        return sendJSON(
                            res,
                            401,
                            {
                                error:
                                    "Invalid admin username or password"
                            }
                        );
                    }

                    const t = token();

                    sessions.add(t);

                    return sendJSON(
                        res,
                        200,
                        {
                            success: true,
                            token: t
                        }
                    );
                }

                if (
                    p.startsWith(
                        "/api/admin/"
                    )
                ) {
                    if (!loggedIn(req)) {
                        return sendJSON(
                            res,
                            401,
                            {
                                error:
                                    "Unauthorized"
                            }
                        );
                    }

                    return proxy(
                        req,
                        res
                    );
                }

                return sendJSON(
                    res,
                    404,
                    {
                        error:
                            "Not found"
                    }
                );

            } catch (error) {

                console.error(error);

                return sendJSON(
                    res,
                    500,
                    {
                        error:
                            "Server error"
                    }
                );
            }
        }
    );

server.listen(
    PORT,
    "127.0.0.1",
    () => {
        console.log(
            "Noon Market ADMIN: http://127.0.0.1:" +
            PORT +
            "/admin.html"
        );

        console.log(
            "Live backend: " +
            LIVE_BACKEND
        );
    }
);
