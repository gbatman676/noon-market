const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "CHANGE_THIS_ADMIN_PASSWORD";

const CUSTOMER_SERVICE =
    "https://t.me/customer_service_34";

const DB_FILE =
    path.join(__dirname, "data.json");

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        return {
            users: [],
            transactions: [],
            audit: []
        };
    }

    try {
        return JSON.parse(
            fs.readFileSync(DB_FILE, "utf8")
        );
    } catch {
        return {
            users: [],
            transactions: [],
            audit: []
        };
    }
}

const db = loadDB();
const sessions = new Map();

function saveDB() {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(db, null, 2),
        "utf8"
    );
}

function makeId() {
    return crypto.randomUUID();
}

function now() {
    return new Date().toISOString();
}

function passwordHash(password, salt) {
    const realSalt =
        salt ||
        crypto.randomBytes(16).toString("hex");

    return {
        salt: realSalt,
        hash: crypto
            .scryptSync(password, realSalt, 64)
            .toString("hex")
    };
}

function checkPassword(password, salt, hash) {
    try {
        const calculated =
            crypto.scryptSync(
                password,
                salt,
                64
            );

        const stored =
            Buffer.from(hash, "hex");

        return (
            calculated.length === stored.length &&
            crypto.timingSafeEqual(
                calculated,
                stored
            )
        );
    } catch {
        return false;
    }
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type":
            "application/json; charset=utf-8",
        "Cache-Control":
            "no-store",
        "Access-Control-Allow-Origin":
            "*",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization",
        "Access-Control-Allow-Methods":
            "GET,POST,PATCH,OPTIONS"
    });

    res.end(JSON.stringify(data));
}

function getBody(req) {
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
                reject(
                    new Error("Invalid JSON")
                );
            }
        });

        req.on("error", reject);
    });
}

function getSession(req) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token =
        header.substring(7);

    return sessions.get(token) || null;
}

function publicUser(user) {
    return {
        id: user.id,
        email: user.email || "",
        phone: user.phone || "",
        status: user.status || "active",
        balance: Number(user.balance || 0),
        createdAt: user.createdAt || ""
    };
}

async function getMarket() {
    try {
        const response =
            await fetch(
                "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd&include_24hr_change=true"
            );

        if (!response.ok) {
            throw new Error(
                "Market request failed"
            );
        }

        const data =
            await response.json();

        return {
            btc: {
                price: data.bitcoin.usd,
                change:
                    data.bitcoin.usd_24h_change || 0
            },
            usdt: {
                price: data.tether.usd,
                change:
                    data.tether.usd_24h_change || 0
            },
            updatedAt: now()
        };
    } catch {
        return {
            btc: {
                price: 0,
                change: 0
            },
            usdt: {
                price: 1,
                change: 0
            },
            updatedAt: now()
        };
    }
}

const server =
    http.createServer(async (req, res) => {

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            return res.end();
        }

        const url =
            new URL(
                req.url,
                "http://localhost"
            );

        const p = url.pathname;

        try {

            /*
            ==========================
            CUSTOMER HOME
            ==========================
            */

            if (
                req.method === "GET" &&
                p === "/"
            ) {
                res.writeHead(200, {
                    "Content-Type":
                        "text/html; charset=utf-8",
                    "Cache-Control":
                        "no-store"
                });

                return res.end(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>Noon Market</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #f5f6f8;
    color: #111827;
}

header {
    background: white;
    padding: 18px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
}

.logo {
    font-size: 24px;
    font-weight: 800;
}

.container {
    max-width: 700px;
    margin: auto;
    padding: 20px;
}

.card {
    background: white;
    padding: 20px;
    border-radius: 18px;
    margin-bottom: 15px;
    box-shadow: 0 5px 20px #00000010;
}

.balance {
    background: #111827;
    color: white;
    padding: 25px;
    border-radius: 20px;
    margin-bottom: 15px;
}

.balance strong {
    display: block;
    font-size: 34px;
    margin-top: 8px;
}

input {
    width: 100%;
    padding: 14px;
    margin: 7px 0;
    border: 1px solid #ddd;
    border-radius: 10px;
}

button {
    cursor: pointer;
}

.btn {
    width: 100%;
    padding: 14px;
    border: 0;
    border-radius: 12px;
    background: #111827;
    color: white;
    font-weight: bold;
    margin-top: 8px;
}

.market {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.coin {
    background: white;
    padding: 18px;
    border-radius: 16px;
}

.price {
    font-size: 22px;
    font-weight: bold;
    margin-top: 8px;
}

.actions {
    display: grid;
    grid-template-columns:
        repeat(3, 1fr);
    gap: 10px;
    margin: 15px 0;
}

.action {
    padding: 18px 5px;
    border: 0;
    background: white;
    border-radius: 15px;
    font-weight: bold;
}

.plan {
    background: white;
    padding: 16px;
    border-radius: 15px;
    margin: 10px 0;
    display: flex;
    justify-content: space-between;
}

.bottom {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #eee;
    padding: 15px;
    display: flex;
    justify-content: space-around;
}

.nav {
    background: none;
    border: 0;
}

@media(max-width:600px) {
    .market {
        grid-template-columns: 1fr;
    }
}
</style>
</head>

<body>

<div id="app"></div>

<script>

let user =
JSON.parse(
localStorage.getItem("noon_user") || "null"
);

function money(value) {
    return "$" +
        Number(value || 0)
        .toFixed(2);
}

function loginPage() {

    app.innerHTML = \`
        <div class="container"
             style="padding-top:70px">

            <div class="card">

                <h1>Noon Market</h1>

                <p>
                    Secure account access
                </p>

                <input
                    id="email"
                    placeholder="Email Address">

                <input
                    id="phone"
                    placeholder="Phone Number">

                <input
                    id="password"
                    type="password"
                    placeholder="Password">

                <button
                    class="btn"
                    onclick="register()">
                    Sign In / Create Account
                </button>

            </div>

        </div>
    \`;
}

async function register() {

    const email =
        document
        .getElementById("email")
        .value.trim();

    const phone =
        document
        .getElementById("phone")
        .value.trim();

    const password =
        document
        .getElementById("password")
        .value;

    if (!email && !phone) {
        alert(
            "Enter email or phone number"
        );
        return;
    }

    if (password.length < 8) {
        alert(
            "Password must be at least 8 characters"
        );
        return;
    }

    const response =
        await fetch(
            "/api/users",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    email,
                    phone,
                    password
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        alert(
            data.error ||
            "Unable to create account"
        );
        return;
    }

    user = data.user;

    localStorage.setItem(
        "noon_user",
        JSON.stringify(user)
    );

    home();
}

function home() {

    app.innerHTML = \`
        <header>
            <div class="logo">
                Noon Market
            </div>

            <button
                onclick="logout()">
                Sign Out
            </button>
        </header>

        <div class="container">

            <div class="balance">

                <small>
                    Available Balance
                </small>

                <strong>
                    \${money(user.balance)}
                </strong>

                <small>
                    \${user.email || user.phone}
                </small>

            </div>

            <div class="market">

                <div class="coin">
                    <b>BTC / USD</b>
                    <div
                        id="btc"
                        class="price">
                        Loading...
                    </div>
                </div>

                <div class="coin">
                    <b>USDT / USD</b>
                    <div
                        id="usdt"
                        class="price">
                        Loading...
                    </div>
                </div>

            </div>

            <div class="actions">

                <button
                    class="action"
                    onclick="service()">
                    Deposit
                </button>

                <button
                    class="action"
                    onclick="service()">
                    Withdrawal
                </button>

                <button
                    class="action"
                    onclick="plans()">
                    Our Plans
                </button>

            </div>

            <div class="card">

                <h3>
                    Customer Service
                </h3>

                <button
                    class="btn"
                    onclick="service()">
                    Customer Service
                </button>

            </div>

        </div>

        <div class="bottom">

            <button
                class="nav"
                onclick="home()">
                Home
            </button>

            <button
                class="nav"
                onclick="plans()">
                Plans
            </button>

            <button
                class="nav"
                onclick="service()">
                Service
            </button>

            <button
                class="nav"
                onclick="account()">
                Account
            </button>

        </div>
    \`;

    loadMarket();
}

async function loadMarket() {

    try {

        const response =
            await fetch(
                "/api/market"
            );

        const data =
            await response.json();

        document.getElementById(
            "btc"
        ).textContent =
            money(data.btc.price);

        document.getElementById(
            "usdt"
        ).textContent =
            money(data.usdt.price);

    } catch {

        document.getElementById(
            "btc"
        ).textContent =
            "Unavailable";

        document.getElementById(
            "usdt"
        ).textContent =
            "Unavailable";
    }
}

function plans() {

    app.innerHTML = \`
        <header>
            <div class="logo">
                Noon Market
            </div>
        </header>

        <div class="container">

            <h2>Our Plans</h2>

            \${[
                ["$50", "7%"],
                ["$100", "9%"],
                ["$500", "11%"],
                ["$1,000", "13.5%"],
                ["$10,000", "15%"],
                ["$20,000", "17%"],
                ["$50,000", "18.5%"],
                ["$100,000", "20%"]
            ].map(x => \`
                <div class="plan">
                    <b>\${x[0]}</b>
                    <span>\${x[1]} commission</span>
                </div>
            \`).join("")}

        </div>

        <div class="bottom">
            <button
                class="nav"
                onclick="home()">
                Home
            </button>

            <button
                class="nav"
                onclick="service()">
                Service
            </button>

            <button
                class="nav"
                onclick="account()">
                Account
            </button>
        </div>
    \`;
}

function service() {

    app.innerHTML = \`
        <div class="container"
             style="padding-top:50px">

            <div class="card">

                <h2>
                    Customer Service
                </h2>

                <p>
                    Contact our customer
                    service team.
                </p>

                <a
                    href="${CUSTOMER_SERVICE}"
                    target="_blank">

                    <button class="btn">
                        Contact Customer Service
                    </button>

                </a>

            </div>

        </div>
    \`;
}

function account() {

    app.innerHTML = \`
        <div class="container">

            <div class="card">

                <h2>
                    My Account
                </h2>

                <p>
                    Email:
                    \${user.email || "—"}
                </p>

                <p>
                    Phone:
                    \${user.phone || "—"}
                </p>

                <p>
                    Balance:
                    \${money(user.balance)}
                </p>

                <button
                    class="btn"
                    onclick="logout()">
                    Sign Out
                </button>

            </div>

        </div>
    \`;
}

function logout() {

    localStorage.removeItem(
        "noon_user"
    );

    user = null;

    loginPage();
}

if (user) {
    home();
} else {
    loginPage();
}

</script>

</body>
</html>
                `);
            }

            /*
            ==========================
            MARKET
            ==========================
            */

            if (
                req.method === "GET" &&
                p === "/api/market"
            ) {
                return sendJSON(
                    res,
                    200,
                    await getMarket()
                );
            }

            /*
            ==========================
            CONFIG
            ==========================
            */

            if (
                req.method === "GET" &&
                p === "/api/config"
            ) {
                return sendJSON(
                    res,
                    200,
                    {
                        customerService:
                            CUSTOMER_SERVICE
                    }
                );
            }

            /*
            ==========================
            CUSTOMER REGISTER
            ==========================
            */

            if (
                req.method === "POST" &&
                p === "/api/users"
            ) {

                const data =
                    await getBody(req);

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

                if (!email && !phone) {
                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                "Email or phone is required"
                        }
                    );
                }

                if (password.length < 8) {
                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                "Password must be at least 8 characters"
                        }
                    );
                }

                const exists =
                    db.users.find(user =>
                        (
                            email &&
                            user.email === email
                        ) ||
                        (
                            phone &&
                            user.phone === phone
                        )
                    );

                if (exists) {
                    return sendJSON(
                        res,
                        409,
                        {
                            error:
                                "Account already exists"
                        }
                    );
                }

                const passwordData =
                    passwordHash(password);

                const user = {
                    id: makeId(),
                    email: email || null,
                    phone: phone || null,
                    passwordHash:
                        passwordData.hash,
                    passwordSalt:
                        passwordData.salt,
                    status: "active",
                    balance: 0,
                    createdAt: now()
                };

                db.users.push(user);
                saveDB();

                return sendJSON(
                    res,
                    201,
                    {
                        success: true,
                        user:
                            publicUser(user)
                    }
                );
            }

            /*
            ==========================
            CUSTOMER LOGIN
            ==========================
            */

            if (
                req.method === "POST" &&
                p === "/api/login"
            ) {

                const data =
                    await getBody(req);

                const identifier =
                    String(
                        data.identifier || ""
                    ).trim();

                const user =
                    db.users.find(u =>
                        (
                            u.email &&
                            u.email ===
                            identifier.toLowerCase()
                        ) ||
                        (
                            u.phone &&
                            u.phone === identifier
                        )
                    );

                if (
                    !user ||
                    !checkPassword(
                        String(
                            data.password || ""
                        ),
                        user.passwordSalt,
                        user.passwordHash
                    )
                ) {
                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Invalid credentials"
                        }
                    );
                }

                if (
                    user.status !==
                    "active"
                ) {
                    return sendJSON(
                        res,
                        403,
                        {
                            error:
                                "Account is suspended"
                        }
                    );
                }

                const token =
                    crypto
                        .randomBytes(32)
                        .toString("hex");

                sessions.set(
                    token,
                    {
                        role: "user",
                        userId: user.id
                    }
                );

                return sendJSON(
                    res,
                    200,
                    {
                        token,
                        user:
                            publicUser(user)
                    }
                );
            }

            /*
            ==========================
            ADMIN LOGIN
            ==========================
            */

            if (
                req.method === "POST" &&
                p === "/api/admin/login"
            ) {

                const data =
                    await getBody(req);

                if (
                    data.username !==
                        ADMIN_USER ||
                    data.password !==
                        ADMIN_PASSWORD
                ) {
                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Invalid admin credentials"
                        }
                    );
                }

                const token =
                    crypto
                        .randomBytes(32)
                        .toString("hex");

                sessions.set(
                    token,
                    {
                        role: "admin"
                    }
                );

                return sendJSON(
                    res,
                    200,
                    {
                        success: true,
                        token
                    }
                );
            }

            /*
            ==========================
            ADMIN USERS
            ==========================
            */

            if (
                req.method === "GET" &&
                p === "/api/admin/users"
            ) {

                const session =
                    getSession(req);

                if (
                    !session ||
                    session.role !== "admin"
                ) {
                    return sendJSON(
                        res,
                        403,
                        {
                            error:
                                "Admin access required"
                        }
                    );
                }

                return sendJSON(
                    res,
                    200,
                    {
                        success: true,
                        users:
                            db.users.map(
                                publicUser
                            )
                    }
                );
            }

            /*
            ==========================
            ADMIN BALANCE
            ==========================
            */

            const balanceMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/balance$/
                );

            if (
                req.method === "POST" &&
                balanceMatch
            ) {

                const session =
                    getSession(req);

                if (
                    !session ||
                    session.role !== "admin"
                ) {
                    return sendJSON(
                        res,
                        403,
                        {
                            error:
                                "Admin access required"
                        }
                    );
                }

                const user =
                    db.users.find(
                        u =>
                            u.id ===
                            balanceMatch[1]
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

                const data =
                    await getBody(req);

                const amount =
                    Number(data.amount);

                const type =
                    String(
                        data.type || ""
                    );

                const reason =
                    String(
                        data.reason || ""
                    ).trim();

                if (
                    !Number.isFinite(
                        amount
                    ) ||
                    amount <= 0 ||
                    ![
                        "credit",
                        "debit"
                    ].includes(type)
                ) {
                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                "Invalid balance request"
                        }
                    );
                }

                if (
                    type === "debit" &&
                    Number(user.balance) <
                        amount
                ) {
                    return sendJSON(
                        res,
                        400,
                        {
                            error:
                                "Insufficient balance"
                        }
                    );
                }

                const change =
                    type === "credit"
                        ? amount
                        : -amount;

                user.balance =
                    Number(
                        (
                            Number(
                                user.balance
                            ) + change
                        ).toFixed(2)
                    );

                const transaction = {
                    id: makeId(),
                    userId: user.id,
                    type,
                    amount: change,
                    reason,
                    time: now(),
                    actor: "admin"
                };

                db.transactions.push(
                    transaction
                );

                saveDB();

                return sendJSON(
                    res,
                    200,
                    {
                        success: true,
                        user:
                            publicUser(user),
                        transaction
                    }
                );
            }

            /*
            ==========================
            ADMIN STATUS
            ==========================
            */

            const statusMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/status$/
                );

            if (
                req.method === "PATCH" &&
                statusMatch
            ) {

                const session =
                    getSession(req);

                if (
                    !session ||
                    session.role !== "admin"
                ) {
                    return sendJSON(
                        res,
                        403,
                        {
                            error:
                                "Admin access required"
                        }
                    );
                }

                const user =
                    db.users.find(
                        u =>
                            u.id ===
                            statusMatch[1]
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

                const data =
                    await getBody(req);

                user.status =
                    data.status ===
                    "suspended"
                        ? "suspended"
                        : "active";

                saveDB();

                return sendJSON(
                    res,
                    200,
                    {
                        success: true,
                        user:
                            publicUser(user)
                    }
                );
            }

            /*
            ==========================
            NOT FOUND
            ==========================
            */

            return sendJSON(
                res,
                404,
                {
                    error: "Not found"
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
    });

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            "Noon Market backend running on port " +
            PORT
        );
    }
);
