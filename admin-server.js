const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;

// LIVE RENDER BACKEND
const LIVE_BACKEND =
    process.env.LIVE_BACKEND ||
    "https://noon-market.onrender.com";


function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization",
        "Access-Control-Allow-Methods":
            "GET,POST,PATCH,OPTIONS"
    });

    res.end(JSON.stringify(data));
}


function adminHTML() {

    const file =
        path.join(__dirname, "admin.html");

    if (!fs.existsSync(file)) {

        return `
<!doctype html>
<html>
<body
style="font-family:Arial;padding:30px"
>

<h2>Noon Market Admin</h2>

<p>
admin.html not found.
</p>

</body>
</html>
`;
    }

    return fs.readFileSync(
        file,
        "utf8"
    );
}


function readBody(req) {

    return new Promise(
        (resolve, reject) => {

            let data = "";

            req.on(
                "data",
                chunk => {
                    data += chunk;
                }
            );

            req.on(
                "end",
                () => {
                    resolve(data);
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}


function proxyRequest(req, res) {

    let target;

    try {

        target =
            new URL(
                LIVE_BACKEND +
                req.url
            );

    } catch (error) {

        return sendJSON(
            res,
            500,
            {
                error:
                    "Invalid live backend URL"
            }
        );
    }


    const options = {

        protocol:
            target.protocol,

        hostname:
            target.hostname,

        port:
            target.port ||
            (
                target.protocol === "https:"
                    ? 443
                    : 80
            ),

        path:
            target.pathname +
            target.search,

        method:
            req.method,

        headers: {

            "Content-Type":
                req.headers[
                    "content-type"
                ] ||
                "application/json",

            "Authorization":
                req.headers.authorization ||
                "",

            "Accept":
                "application/json"
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
                            upstreamRes.statusCode ||
                            502,
                            {

                                "Content-Type":
                                    upstreamRes
                                        .headers[
                                            "content-type"
                                        ] ||
                                    "application/json; charset=utf-8",

                                "Cache-Control":
                                    "no-store",

                                "Access-Control-Allow-Origin":
                                    "*",

                                "Access-Control-Allow-Headers":
                                    "Content-Type, Authorization",

                                "Access-Control-Allow-Methods":
                                    "GET,POST,PATCH,OPTIONS"
                            }
                        );


                        res.end(data);

                    }
                );

            }
        );


    upstream.on(
        "error",
        error => {

            console.error(
                "Live backend proxy error:",
                error.message
            );


            sendJSON(
                res,
                502,
                {

                    error:
                        "Live backend unavailable",

                    details:
                        error.message
                }
            );

        }
    );


    readBody(req)
        .then(
            data => {

                if (data) {

                    upstream.write(data);

                }

                upstream.end();

            }
        )
        .catch(
            error => {

                upstream.destroy();

                sendJSON(
                    res,
                    400,
                    {
                        error:
                            error.message
                    }
                );

            }
        );
}


const server =
    http.createServer(
        (req, res) => {

            const url =
                new URL(
                    req.url,
                    "http://127.0.0.1:" +
                    PORT
                );


            const p =
                url.pathname;


            // =====================================================
            // OPTIONS / CORS
            // =====================================================

            if (
                req.method ===
                "OPTIONS"
            ) {

                res.writeHead(
                    204,
                    {

                        "Access-Control-Allow-Origin":
                            "*",

                        "Access-Control-Allow-Headers":
                            "Content-Type, Authorization",

                        "Access-Control-Allow-Methods":
                            "GET,POST,PATCH,OPTIONS"
                    }
                );

                return res.end();
            }


            // =====================================================
            // ADMIN PAGE
            // =====================================================

            if (
                req.method === "GET" &&
                (
                    p === "/" ||
                    p === "/admin.html"
                )
            ) {

                res.writeHead(
                    200,
                    {

                        "Content-Type":
                            "text/html; charset=utf-8",

                        "Cache-Control":
                            "no-store"
                    }
                );


                return res.end(
                    adminHTML()
                );
            }


            // =====================================================
            // LIVE ADMIN API PROXY
            // =====================================================

            if (
                p.startsWith(
                    "/api/admin/"
                )
            ) {

                return proxyRequest(
                    req,
                    res
                );
            }


            // =====================================================
            // NOT FOUND
            // =====================================================

            return sendJSON(
                res,
                404,
                {
                    error:
                        "Not found"
                }
            );

        }
    );


server.on(
    "error",
    error => {

        console.error(
            error
        );

    }
);


server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            "Noon Market ADMIN proxy: http://127.0.0.1:" +
            PORT
        );

        console.log(
            "Live backend: " +
            LIVE_BACKEND
        );

    }
);
