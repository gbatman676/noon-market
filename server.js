const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const ADMIN_USER =
    process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "CHANGE_THIS_ADMIN_PASSWORD";

const TG =
    "https://t.me/customer_service_34";

const DB =
    path.join(__dirname, "data.json");

function load() {
    try {
        if (!fs.existsSync(DB)) {
            return {
                users: [],
                transactions: [],
                audit: []
            };
        }

        const data =
            JSON.parse(
                fs.readFileSync(DB, "utf8")
            );

        return {
            users: Array.isArray(data.users)
                ? data.users
                : [],

            transactions:
                Array.isArray(data.transactions)
                    ? data.transactions
                    : [],

            audit:
                Array.isArray(data.audit)
                    ? data.audit
                    : []
        };
    } catch (error) {
        console.error("Database load error:", error);

        return {
            users: [],
            transactions: [],
            audit: []
        };
    }
}

const db = load();

const sessions = new Map();

const now = () =>
    new Date().toISOString();

const id = () =>
    crypto.randomUUID();

function save() {
    fs.writeFileSync(
        DB,
        JSON.stringify(db, null, 2),
        "utf8"
    );
}

function hash(password, salt) {
    const actualSalt =
        salt ||
        crypto.randomBytes(16).toString("hex");

    return {
        s: actualSalt,
        h: crypto
            .scryptSync(
                password,
                actualSalt,
                64
            )
            .toString("hex")
    };
}

function verify(password, salt, storedHash) {
    try {
        const calculated =
            crypto.scryptSync(
                password,
                salt,
                64
            );

        const stored =
            Buffer.from(
                storedHash,
                "hex"
            );

        return (
            stored.length === calculated.length &&
            crypto.timingSafeEqual(
                stored,
                calculated
            )
        );
    } catch {
        return false;
    }
}

function out(res, status, data) {
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

    res.end(
        JSON.stringify(data)
    );
}

function body(req) {
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
                    if (!data) {
                        resolve({});
                        return;
                    }

                    try {
                        resolve(
                            JSON.parse(data)
                        );
                    } catch {
                        reject(
                            new Error(
                                "Invalid JSON"
                            )
                        );
                    }
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}

function auth(req) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token =
        header.slice(7);

    return (
        sessions.get(token) ||
        null
    );
}

function audit(
    actor,
    action,
    details
) {
    db.audit.push({
        id: id(),
        actor,
        action,
        details,
        time: now()
    });

    save();
}

function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        balance: Number(
            user.balance || 0
        ),
        createdAt: user.createdAt
    };
}

async function market() {
    const response =
        await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd&include_24hr_change=true"
        );

    if (!response.ok) {
        throw new Error(
            "Market API unavailable"
        );
    }

    const data =
        await response.json();

    return {
        btc: {
            price:
                data.bitcoin.usd,

            change24h:
                data.bitcoin
                    .usd_24h_change || 0
        },

        usdt: {
            price:
                data.tether.usd,

            change24h:
                data.tether
                    .usd_24h_change || 0
        },

        updatedAt: now()
    };
}

const server =
    http.createServer(
        async (req, res) => {

            if (
                req.method === "OPTIONS"
            ) {
                return out(
                    res,
                    204,
                    {}
                );
            }

            const url =
                new URL(
                    req.url,
                    "http://127.0.0.1"
                );

            const p =
                url.pathname;

            try {

                // =========================
                // ADMIN HTML
                // =========================

                if (
                    req.method === "GET" &&
                    (
                        p === "/" ||
                        p === "/admin.html"
                    )
                ) {

                    const adminFile =
                        path.join(
                            __dirname,
                            "admin.html"
                        );

                    if (
                        !fs.existsSync(
                            adminFile
                        )
                    ) {
                        return out(
                            res,
                            404,
                            {
                                error:
                                    "admin.html not found"
                            }
                        );
                    }

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
                        fs.readFileSync(
                            adminFile,
                            "utf8"
                        )
                    );
                }


                // =========================
                // MARKET
                // =========================

                if (
                    req.method === "GET" &&
                    p === "/api/market"
                ) {
                    return out(
                        res,
                        200,
                        await market()
                    );
                }


                // =========================
                // CONFIG
                // =========================

                if (
                    req.method === "GET" &&
                    p === "/api/config"
                ) {
                    return out(
                        res,
                        200,
                        {
                            customerService:
                                TG
                        }
                    );
                }


                // =========================
                // USER REGISTER
                // =========================

                if (
                    req.method === "POST" &&
                    p === "/api/register"
                ) {

                    const b =
                        await body(req);

                    const email =
                        String(
                            b.email || ""
                        )
                        .trim()
                        .toLowerCase();

                    const phone =
                        String(
                            b.phone || ""
                        ).trim();

                    const password =
                        String(
                            b.password || ""
                        );

                    if (
                        !email &&
                        !phone
                    ) {
                        return out(
                            res,
                            400,
                            {
                                error:
                                    "Email or phone is required"
                            }
                        );
                    }

                    if (
                        password.length < 8
                    ) {
                        return out(
                            res,
                            400,
                            {
                                error:
                                    "Password must be at least 8 characters"
                            }
                        );
                    }

                    if (
                        db.users.some(
                            user =>
                                (
                                    email &&
                                    user.email === email
                                ) ||
                                (
                                    phone &&
                                    user.phone === phone
                                )
                        )
                    ) {
                        return out(
                            res,
                            409,
                            {
                                error:
                                    "Account already exists"
                            }
                        );
                    }

                    const passwordData =
                        hash(password);

                    const user = {
                        id: id(),

                        email:
                            email || null,

                        phone:
                            phone || null,

                        passwordHash:
                            passwordData.h,

                        passwordSalt:
                            passwordData.s,

                        status:
                            "active",

                        balance: 0,

                        createdAt:
                            now()
                    };

                    db.users.push(user);

                    save();

                    audit(
                        "system",
                        "user_registered",
                        {
                            userId:
                                user.id
                        }
                    );

                    return out(
                        res,
                        201,
                        {
                            user:
                                publicUser(
                                    user
                                )
                        }
                    );
                }


                // =========================
                // USER LOGIN
                // =========================

                if (
                    req.method === "POST" &&
                    p === "/api/login"
                ) {

                    const b =
                        await body(req);

                    const identifier =
                        String(
                            b.identifier || ""
                        );

                    const user =
                        db.users.find(
                            u =>
                                (
                                    u.email &&
                                    u.email ===
                                        identifier
                                            .toLowerCase()
                                ) ||
                                (
                                    u.phone &&
                                    u.phone ===
                                        identifier
                                )
                        );

                    if (
                        !user ||
                        !verify(
                            String(
                                b.password || ""
                            ),
                            user.passwordSalt,
                            user.passwordHash
                        )
                    ) {
                        return out(
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
                        return out(
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
                            .randomBytes(
                                32
                            )
                            .toString(
                                "hex"
                            );

                    sessions.set(
                        token,
                        {
                            role: "user",
                            userId:
                                user.id
                        }
                    );

                    return out(
                        res,
                        200,
                        {
                            token,

                            user:
                                publicUser(
                                    user
                                )
                        }
                    );
                }


                // =========================
                // ADMIN LOGIN
                // =========================

                if (
                    req.method === "POST" &&
                    p === "/api/admin/login"
                ) {

                    const b =
                        await body(req);

                    const username =
                        String(
                            b.username || ""
                        );

                    const password =
                        String(
                            b.password || ""
                        );

                    if (
                        username !==
                            ADMIN_USER ||
                        password !==
                            ADMIN_PASSWORD
                    ) {
                        return out(
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
                            .randomBytes(
                                32
                            )
                            .toString(
                                "hex"
                            );

                    sessions.set(
                        token,
                        {
                            role: "admin"
                        }
                    );

                    audit(
                        "admin",
                        "admin_login",
                        {}
                    );

                    return out(
                        res,
                        200,
                        {
                            token
                        }
                    );
                }


                // =========================
                // CURRENT USER
                // =========================

                if (
                    req.method === "GET" &&
                    p === "/api/me"
                ) {

                    const session =
                        auth(req);

                    if (!session) {
                        return out(
                            res,
                            401,
                            {
                                error:
                                    "Unauthorized"
                            }
                        );
                    }

                    if (
                        session.role ===
                        "admin"
                    ) {
                        return out(
                            res,
                            200,
                            {
                                role:
                                    "admin"
                            }
                        );
                    }

                    const user =
                        db.users.find(
                            u =>
                                u.id ===
                                session.userId
                        );

                    if (!user) {
                        return out(
                            res,
                            404,
                            {
                                error:
                                    "User not found"
                            }
                        );
                    }

                    return out(
                        res,
                        200,
                        {
                            role:
                                "user",

                            user:
                                publicUser(
                                    user
                                )
                        }
                    );
                }


                // =========================
                // ADMIN USERS LIST
                // =========================

                if (
                    req.method === "GET" &&
                    p === "/api/admin/users"
                ) {

                    const session =
                        auth(req);

                    if (
                        !session ||
                        session.role !==
                            "admin"
                    ) {
                        return out(
                            res,
                            403,
                            {
                                error:
                                    "Admin access required"
                            }
                        );
                    }

                    const q =
                        String(
                            url.searchParams.get(
                                "q"
                            ) || ""
                        )
                        .toLowerCase()
                        .trim();

                    const users =
                        db.users.filter(
                            user => {

                                if (!q) {
                                    return true;
                                }

                                return [
                                    user.email,
                                    user.phone,
                                    user.id
                                ]
                                    .filter(Boolean)
                                    .some(
                                        value =>
                                            String(
                                                value
                                            )
                                            .toLowerCase()
                                            .includes(q)
                                    );
                            }
                        );

                    return out(
                        res,
                        200,
                        {
                            users:
                                users.map(
                                    publicUser
                                )
                        }
                    );
                }


                // =========================
                // ADMIN SINGLE USER
                // =========================

                let match =
                    p.match(
                        /^\/api\/admin\/users\/([^/]+)$/
                    );

                if (
                    match &&
                    req.method === "GET"
                ) {

                    const session =
                        auth(req);

                    if (
                        !session ||
                        session.role !==
                            "admin"
                    ) {
                        return out(
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
                                match[1]
                        );

                    if (!user) {
                        return out(
                            res,
                            404,
                            {
                                error:
                                    "User not found"
                            }
                        );
                    }

                    return out(
                        res,
                        200,
                        {
                            user:
                                publicUser(
                                    user
                                ),

                            transactions:
                                db.transactions.filter(
                                    t =>
                                        t.userId ===
                                        user.id
                                ),

                            audit:
                                db.audit.filter(
                                    a =>
                                        a.details &&
                                        a.details.userId ===
                                            user.id
                                )
                        }
                    );
                }


                // =========================
                // CHANGE USER BALANCE
                // =========================

                match =
                    p.match(
                        /^\/api\/admin\/users\/([^/]+)\/balance$/
                    );

                if (
                    match &&
                    req.method === "POST"
                ) {

                    const session =
                        auth(req);

                    if (
                        !session ||
                        session.role !==
                            "admin"
                    ) {
                        return out(
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
                                match[1]
                        );

                    if (!user) {
                        return out(
                            res,
                            404,
                            {
                                error:
                                    "User not found"
                            }
                        );
                    }

                    const b =
                        await body(req);

                    const amount =
                        Number(
                            b.amount
                        );

                    const reason =
                        String(
                            b.reason || ""
                        ).trim();

                    const type =
                        String(
                            b.type || ""
                        );

                    if (
                        !Number.isFinite(
                            amount
                        ) ||
                        amount <= 0 ||
                        ![
                            "credit",
                            "debit"
                        ].includes(type) ||
                        !reason
                    ) {
                        return out(
                            res,
                            400,
                            {
                                error:
                                    "Valid type, positive amount and reason are required"
                            }
                        );
                    }

                    if (
                        type === "debit" &&
                        Number(
                            user.balance
                        ) < amount
                    ) {
                        return out(
                            res,
                            400,
                            {
                                error:
                                    "Insufficient recorded balance"
                            }
                        );
                    }

                    const delta =
                        type === "credit"
                            ? amount
                            : -amount;

                    user.balance =
                        Number(
                            (
                                Number(
                                    user.balance
                                ) +
                                delta
                            ).toFixed(2)
                        );

                    const transaction = {
                        id: id(),

                        userId:
                            user.id,

                        type,

                        amount:
                            delta,

                        reason,

                        time:
                            now(),

                        actor:
                            "admin"
                    };

                    db.transactions.push(
                        transaction
                    );

                    save();

                    audit(
                        "admin",
                        "balance_ledger_entry",
                        {
                            userId:
                                user.id,

                            transactionId:
                                transaction.id,

                            amount:
                                delta,

                            reason
                        }
                    );

                    return out(
                        res,
                        200,
                        {
                            user:
                                publicUser(
                                    user
                                ),

                            transaction
                        }
                    );
                }


                // =========================
                // SUSPEND / ACTIVATE
                // =========================

                match =
                    p.match(
                        /^\/api\/admin\/users\/([^/]+)\/status$/
                    );

                if (
                    match &&
                    req.method === "PATCH"
                ) {

                    const session =
                        auth(req);

                    if (
                        !session ||
                        session.role !==
                            "admin"
                    ) {
                        return out(
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
                                match[1]
                        );

                    if (!user) {
                        return out(
                            res,
                            404,
                            {
                                error:
                                    "User not found"
                            }
                        );
                    }

                    const b =
                        await body(req);

                    if (
                        ![
                            "active",
                            "suspended"
                        ].includes(
                            b.status
                        )
                    ) {
                        return out(
                            res,
                            400,
                            {
                                error:
                                    "Invalid status"
                            }
                        );
                    }

                    user.status =
                        b.status;

                    save();

                    audit(
                        "admin",
                        "account_status_changed",
                        {
                            userId:
                                user.id,

                            status:
                                user.status
                        }
                    );

                    return out(
                        res,
                        200,
                        {
                            user:
                                publicUser(
                                    user
                                )
                        }
                    );
                }


                // =========================
                // ADMIN AUDIT
                // =========================

                if (
                    req.method === "GET" &&
                    p === "/api/admin/audit"
                ) {

                    const session =
                        auth(req);

                    if (
                        !session ||
                        session.role !==
                            "admin"
                    ) {
                        return out(
                            res,
                            403,
                            {
                                error:
                                    "Admin access required"
                            }
                        );
                    }

                    return out(
                        res,
                        200,
                        {
                            audit:
                                db.audit
                                    .slice(-500)
                                    .reverse()
                        }
                    );
                }


                // =========================
                // NOT FOUND
                // =========================

                return out(
                    res,
                    404,
                    {
                        error:
                            "Not found"
                    }
                );

            } catch (error) {

                console.error(
                    error
                );

                return out(
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
    HOST,
    () => {

        console.log(
            `Noon Market backend: http://${HOST}:${PORT}`
        );

        console.log(
            "Admin page: /admin.html"
        );
    }
);
