const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const TG = "https://t.me/customer_service_34";

const ADMIN_API_KEY =
    process.env.ADMIN_API_KEY ||
    "NoonMarketAdmin_2026_ChangeThis";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
}

function readUsers() {
    try {
        return JSON.parse(
            fs.readFileSync(USERS_FILE, "utf8")
        );
    } catch {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2),
        "utf8"
    );
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type":
            "application/json; charset=utf-8",

        "Cache-Control": "no-store",

        "Access-Control-Allow-Origin": "*",

        "Access-Control-Allow-Headers":
            "Content-Type, X-Admin-Key",

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
            try {
                resolve(
                    data
                        ? JSON.parse(data)
                        : {}
                );
            } catch {
                reject(
                    new Error("Invalid JSON")
                );
            }
        });

        req.on("error", reject);
    });
}


// ============================================================
// ADMIN API
// ============================================================

function adminAuthorized(req) {
    const key =
        String(
            req.headers["x-admin-key"] || ""
        );

    return (
        key &&
        key === ADMIN_API_KEY
    );
}

function publicUser(user) {
    return {
        id: user.id,

        email:
            user.email || "",

        phone:
            user.phone || "",

        balance:
            Number(user.balance || 0),

        status:
            user.status || "active",

        transactions:
            Array.isArray(user.transactions)
                ? user.transactions
                : (
                    Array.isArray(user.records)
                        ? user.records
                        : []
                ),

        createdAt:
            user.createdAt || null
    };
}


// ============================================================
// CRYPTO MARKET
// ============================================================

async function cryptoMarket() {

    const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price" +
        "?ids=bitcoin,ethereum,tether,binancecoin,solana,ripple" +
        "&vs_currencies=usd" +
        "&include_24hr_change=true"
    );

    if (!r.ok) {
        throw Error(
            "Crypto market unavailable"
        );
    }

    const d = await r.json();

    return {

        BTC: {
            price:
                Number(
                    d.bitcoin?.usd || 0
                ),

            change:
                Number(
                    d.bitcoin?.usd_24h_change || 0
                )
        },

        ETH: {
            price:
                Number(
                    d.ethereum?.usd || 0
                ),

            change:
                Number(
                    d.ethereum?.usd_24h_change || 0
                )
        },

        USDT: {
            price:
                Number(
                    d.tether?.usd || 0
                ),

            change:
                Number(
                    d.tether?.usd_24h_change || 0
                )
        },

        BNB: {
            price:
                Number(
                    d.binancecoin?.usd || 0
                ),

            change:
                Number(
                    d.binancecoin?.usd_24h_change || 0
                )
        },

        SOL: {
            price:
                Number(
                    d.solana?.usd || 0
                ),

            change:
                Number(
                    d.solana?.usd_24h_change || 0
                )
        },

        XRP: {
            price:
                Number(
                    d.ripple?.usd || 0
                ),

            change:
                Number(
                    d.ripple?.usd_24h_change || 0
                )
        },

        updatedAt:
            new Date().toISOString()
    };
}


// ============================================================
// SERVER
// ============================================================

const server =
    http.createServer(
        async (req, res) => {

            const url =
                new URL(
                    req.url,
                    "http://127.0.0.1:3000"
                );

            const p =
                url.pathname;


            // ==================================================
            // OPTIONS / CORS
            // ==================================================

            if (
                req.method === "OPTIONS"
            ) {
                res.writeHead(
                    204,
                    {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers":
                            "Content-Type, X-Admin-Key",
                        "Access-Control-Allow-Methods":
                            "GET,POST,PATCH,OPTIONS"
                    }
                );

                return res.end();
            }


            // ==================================================
            // CREATE USER
            // ==================================================

            if (
                req.method === "POST" &&
                p === "/api/users"
            ) {

                try {

                    const data =
                        await body(req);

                    const email =
                        String(
                            data.email || ""
                        )
                            .trim()
                            .toLowerCase();

                    const phone =
                        String(
                            data.phone || ""
                        ).trim();

                    const password =
                        String(
                            data.password || ""
                        );


                    if (
                        !email &&
                        !phone
                    ) {

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Email or phone is required"
                            }
                        );
                    }


                    if (!password) {

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Password is required"
                            }
                        );
                    }


                    const users =
                        readUsers();


                    const exists =
                        users.find(
                            user =>
                                (
                                    email &&
                                    String(
                                        user.email || ""
                                    )
                                        .toLowerCase() ===
                                    email
                                ) ||
                                (
                                    phone &&
                                    String(
                                        user.phone || ""
                                    ).trim() ===
                                    phone
                                )
                        );


                    if (exists) {

                        return sendJSON(
                            res,
                            409,
                            {
                                error:
                                    "Account already exists. Please use Login."
                            }
                        );
                    }


                    const user = {

                        id:
                            "user_" +
                            Date.now() +
                            "_" +
                            Math.random()
                                .toString(36)
                                .slice(2, 8),

                        email,

                        phone,

                        password,

                        // NEW ACCOUNT ALWAYS STARTS AT 0
                        balance: 0,

                        status:
                            "active",

                        transactions: [],

                        createdAt:
                            new Date()
                                .toISOString()
                    };


                    users.push(user);

                    writeUsers(users);


                    return sendJSON(
                        res,
                        201,
                        {
                            success: true,

                            user: {
                                id:
                                    user.id,

                                email:
                                    user.email,

                                phone:
                                    user.phone,

                                balance:
                                    user.balance,

                                status:
                                    user.status,

                                transactions:
                                    user.transactions,

                                createdAt:
                                    user.createdAt
                            }
                        }
                    );


                } catch (error) {

                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                error.message
                        }
                    );
                }
            }


            // ==================================================
            // GET USER
            // ==================================================

            const userMatch =
                p.match(
                    /^\/api\/users\/([^/]+)$/
                );


            if (
                req.method === "GET" &&
                userMatch
            ) {

                const id =
                    decodeURIComponent(
                        userMatch[1]
                    );

                const users =
                    readUsers();

                const user =
                    users.find(
                        x =>
                            x.id === id
                    );


                if (!user) {

                    return sendJSON(
                        res,
                        404,
                        {
                            error:
                                "User not found"
                        }
                    );
                }


                return sendJSON(
                    res,
                    200,
                    {
                        success: true,

                        user: {
                            id:
                                user.id,

                            email:
                                user.email || "",

                            phone:
                                user.phone || "",

                            balance:
                                Number(
                                    user.balance || 0
                                ),

                            status:
                                user.status ||
                                "active",

                            transactions:
                                user.transactions ||
                                user.records ||
                                []
                        }
                    }
                );
            }


            // ==================================================
            // LOGIN
            // ==================================================

            if (
                req.method === "POST" &&
                p === "/api/login"
            ) {

                try {

                    const data =
                        await body(req);

                    const identifier =
                        String(
                            data.identifier ||
                            data.email ||
                            data.phone ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const password =
                        String(
                            data.password || ""
                        );


                    const users =
                        readUsers();


                    const user =
                        users.find(
                            x => {

                                const email =
                                    String(
                                        x.email || ""
                                    )
                                        .trim()
                                        .toLowerCase();

                                const phone =
                                    String(
                                        x.phone || ""
                                    )
                                        .trim()
                                        .toLowerCase();

                                return (
                                    (
                                        email ===
                                        identifier ||
                                        phone ===
                                        identifier
                                    ) &&
                                    String(
                                        x.password || ""
                                    ) ===
                                    password
                                );
                            }
                        );


                    if (!user) {

                        return sendJSON(
                            res,
                            401,
                            {
                                error:
                                    "Invalid email/phone or password"
                            }
                        );
                    }


                    if (
                        user.status ===
                        "suspended"
                    ) {

                        return sendJSON(
                            res,
                            403,
                            {
                                error:
                                    "Account suspended"
                            }
                        );
                    }


                    return sendJSON(
                        res,
                        200,
                        {
                            success: true,

                            user: {
                                id:
                                    user.id,

                                email:
                                    user.email || "",

                                phone:
                                    user.phone || "",

                                balance:
                                    Number(
                                        user.balance || 0
                                    ),

                                status:
                                    user.status ||
                                    "active",

                                transactions:
                                    user.transactions ||
                                    user.records ||
                                    []
                            }
                        }
                    );


                } catch (error) {

                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                error.message
                        }
                    );
                }
            }


            // ==================================================
            // MARKET
            // ==================================================

            if (
                req.method === "GET" &&
                p === "/api/market"
            ) {

                try {

                    const market =
                        await cryptoMarket();

                    return sendJSON(
                        res,
                        200,
                        market
                    );

                } catch (error) {

                    return sendJSON(
                        res,
                        503,
                        {
                            error:
                                error.message
                        }
                    );
                }
            }


            // ==================================================
            // ADMIN USER LIST
            // ==================================================

            if (
                req.method === "GET" &&
                p === "/api/admin/users"
            ) {

                if (
                    !adminAuthorized(req)
                ) {

                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Unauthorized"
                        }
                    );
                }


                const search =
                    String(
                        url.searchParams.get("q") ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                let users =
                    readUsers();


                if (search) {

                    users =
                        users.filter(
                            user =>
                                String(
                                    user.id || ""
                                )
                                    .toLowerCase()
                                    .includes(search) ||

                                String(
                                    user.email || ""
                                )
                                    .toLowerCase()
                                    .includes(search) ||

                                String(
                                    user.phone || ""
                                )
                                    .toLowerCase()
                                    .includes(search)
                        );
                }


                return sendJSON(
                    res,
                    200,
                    {
                        success: true,

                        users:
                            users.map(
                                publicUser
                            )
                    }
                );
            }


            // ==================================================
            // ADMIN SINGLE USER
            // ==================================================

            const adminUserMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)$/
                );


            if (
                req.method === "GET" &&
                adminUserMatch
            ) {

                if (
                    !adminAuthorized(req)
                ) {

                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Unauthorized"
                        }
                    );
                }


                const id =
                    decodeURIComponent(
                        adminUserMatch[1]
                    );


                const users =
                    readUsers();


                const user =
                    users.find(
                        x =>
                            x.id === id
                    );


                if (!user) {

                    return sendJSON(
                        res,
                        404,
                        {
                            error:
                                "User not found"
                        }
                    );
                }


                return sendJSON(
                    res,
                    200,
                    {
                        success: true,

                        user:
                            publicUser(
                                user
                            )
                    }
                );
            }


            // ==================================================
            // ADMIN CHANGE BALANCE
            // ==================================================

            const adminBalanceMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/balance$/
                );


            if (
                req.method === "POST" &&
                adminBalanceMatch
            ) {

                if (
                    !adminAuthorized(req)
                ) {

                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Unauthorized"
                        }
                    );
                }


                try {

                    const id =
                        decodeURIComponent(
                            adminBalanceMatch[1]
                        );


                    const data =
                        await body(req);


                    const amount =
                        Number(
                            data.amount
                        );


                    if (
                        !Number.isFinite(
                            amount
                        ) ||
                        amount <= 0
                    ) {

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Invalid amount"
                            }
                        );
                    }


                    const type =
                        data.type ===
                        "debit"
                            ? "debit"
                            : "credit";


                    const users =
                        readUsers();


                    const user =
                        users.find(
                            x =>
                                x.id === id
                        );


                    if (!user) {

                        return sendJSON(
                            res,
                            404,
                            {
                                error:
                                    "User not found"
                            }
                        );
                    }


                    user.balance =
                        Number(
                            user.balance || 0
                        );


                    if (
                        type ===
                        "credit"
                    ) {

                        user.balance +=
                            amount;

                    } else {

                        user.balance -=
                            amount;


                        if (
                            user.balance <
                            0
                        ) {

                            user.balance =
                                0;
                        }
                    }


                    if (
                        !Array.isArray(
                            user.transactions
                        )
                    ) {

                        user.transactions =
                            [];
                    }


                    user.transactions.push({

                        type,

                        amount,

                        reason:
                            String(
                                data.reason ||
                                ""
                            ),

                        time:
                            new Date()
                                .toISOString()
                    });


                    writeUsers(users);


                    return sendJSON(
                        res,
                        200,
                        {
                            success: true,

                            user:
                                publicUser(
                                    user
                                )
                        }
                    );


                } catch (error) {

                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                error.message
                        }
                    );
                }
            }


            // ==================================================
            // ADMIN CHANGE ACCOUNT STATUS
            // ==================================================

            const adminStatusMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/status$/
                );


            if (
                req.method === "PATCH" &&
                adminStatusMatch
            ) {

                if (
                    !adminAuthorized(req)
                ) {

                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Unauthorized"
                        }
                    );
                }


                try {

                    const id =
                        decodeURIComponent(
                            adminStatusMatch[1]
                        );


                    const data =
                        await body(req);


                    if (
                        data.status !==
                            "active" &&
                        data.status !==
                            "suspended"
                    ) {

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Invalid status"
                            }
                        );
                    }


                    const users =
                        readUsers();


                    const user =
                        users.find(
                            x =>
                                x.id === id
                        );


                    if (!user) {

                        return sendJSON(
                            res,
                            404,
                            {
                                error:
                                    "User not found"
                            }
                        );
                    }


                    user.status =
                        data.status;


                    writeUsers(users);


                    return sendJSON(
                        res,
                        200,
                        {
                            success: true,

                            user:
                                publicUser(
                                    user
                                )
                        }
                    );


                } catch (error) {

                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                error.message
                        }
                    );
                }
            }


            // ==================================================
            // HOME / WEBSITE
            // ==================================================

            if (
                req.method === "GET" &&
                (
                    p === "/" ||
                    p === "/index.html"
                )
            ) {

                const indexFile =
                    path.join(
                        __dirname,
                        "index.html"
                    );


                if (
                    fs.existsSync(
                        indexFile
                    )
                ) {

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/html; charset=utf-8"
                        }
                    );

                    return res.end(
                        fs.readFileSync(
                            indexFile,
                            "utf8"
                        )
                    );
                }
            }


            // ==================================================
            // STATIC FILES
            // ==================================================

            let filePath =
                path.join(
                    __dirname,
                    p === "/"
                        ? "index.html"
                        : p
                );


            if (
                filePath.includes("..")
            ) {

                return sendJSON(
                    res,
                    400,
                    {
                        error:
                            "Invalid path"
                    }
                );
            }


            if (
                fs.existsSync(
                    filePath
                ) &&
                fs.statSync(
                    filePath
                ).isFile()
            ) {

                const ext =
                    path.extname(
                        filePath
                    ).toLowerCase();


                const types = {

                    ".html":
                        "text/html; charset=utf-8",

                    ".js":
                        "application/javascript; charset=utf-8",

                    ".css":
                        "text/css; charset=utf-8",

                    ".json":
                        "application/json; charset=utf-8",

                    ".png":
                        "image/png",

                    ".jpg":
                        "image/jpeg",

                    ".jpeg":
                        "image/jpeg",

                    ".svg":
                        "image/svg+xml",

                    ".ico":
                        "image/x-icon"
                };


                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            types[ext] ||
                            "application/octet-stream"
                    }
                );


                return res.end(
                    fs.readFileSync(
                        filePath
                    )
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
        }
    );


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Noon Market backend running on port ${PORT}`
        );

    }
);
