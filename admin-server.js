const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3001;
const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "ChangeMe123!";

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
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
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

const sessions = new Map();

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8"
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
                resolve(data ? JSON.parse(data) : {});
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
}

function auth(req) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return false;
    }

    return sessions.has(header.substring(7));
}

function adminHTML() {
    const file = path.join(__dirname, "admin.html");

    if (!fs.existsSync(file)) {
        return `
<!doctype html>
<html>
<body style="font-family:Arial;padding:30px">
<h2>Noon Market Admin</h2>
<p>admin.html not found.</p>
</body>
</html>`;
    }

    return fs.readFileSync(file, "utf8");
}

const server = http.createServer(async (req, res) => {

    const url = new URL(
        req.url,
        "http://127.0.0.1:3001"
    );

    const p = url.pathname;

    // ADMIN PAGE
    if (req.method === "GET" && p === "/") {
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        return res.end(adminHTML());
    }

    // ALSO SUPPORT /admin.html
    if (req.method === "GET" && p === "/admin.html") {
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        return res.end(adminHTML());
    }

    // ADMIN LOGIN
    if (
        req.method === "POST" &&
        p === "/api/admin/login"
    ) {
        try {
            const data = await body(req);

            if (
                data.username !== ADMIN_USER ||
                data.password !== ADMIN_PASSWORD
            ) {
                return sendJSON(res, 401, {
                    error: "Invalid admin username or password"
                });
            }

            const token =
                crypto.randomBytes(32).toString("hex");

            sessions.set(token, {
                created: Date.now()
            });

            return sendJSON(res, 200, {
                success: true,
                token
            });

        } catch (error) {
            return sendJSON(res, 400, {
                error: error.message
            });
        }
    }
// CREATE USER FROM MAIN WEBSITE
if (
    req.method === "POST" &&
    p === "/api/users"
) {
    try {
        const data = await body(req);

        const email = String(data.email || "").trim().toLowerCase();
        const phone = String(data.phone || "").trim();
        const password = String(data.password || "");

        if (!email && !phone) {
            return sendJSON(res, 400, {
                error: "Email or phone is required"
            });
        }

        if (!password) {
            return sendJSON(res, 400, {
                error: "Password is required"
            });
        }

        const users = readUsers();

        const exists = users.find(user =>
            (email && user.email === email) ||
            (phone && user.phone === phone)
        );

        if (exists) {
            return sendJSON(res, 409, {
                error: "Account already exists"
            });
        }

        const user = {
            id: crypto.randomUUID(),
            email: email,
            phone: phone,
            password: password,
            balance: 0,
            status: "active",
            transactions: [],
            createdAt: new Date().toISOString()
        };

        users.push(user);

        writeUsers(users);

        return sendJSON(res, 201, {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                balance: user.balance,
                status: user.status,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        return sendJSON(res, 400, {
            error: error.message
        });
    }
}
   
    // USER LIST
    if (
        req.method === "GET" &&
        p === "/api/admin/users"
    ) {
        if (!auth(req)) {
            return sendJSON(res, 401, {
                error: "Unauthorized"
            });
        }

        const search =
            (url.searchParams.get("q") || "")
            .toLowerCase();

        let users = readUsers();

        if (search) {
            users = users.filter(user =>
                String(user.id || "")
                    .toLowerCase()
                    .includes(search) ||

                String(user.email || "")
                    .toLowerCase()
                    .includes(search) ||

                String(user.phone || "")
                    .toLowerCase()
                    .includes(search)
            );
        }

        return sendJSON(res, 200, {
            success: true,
            users
        });
    }

    // SINGLE USER
    const userMatch =
        p.match(/^\/api\/admin\/users\/([^/]+)$/);

    if (
        req.method === "GET" &&
        userMatch
    ) {
        if (!auth(req)) {
            return sendJSON(res, 401, {
                error: "Unauthorized"
            });
        }

        const id =
            decodeURIComponent(userMatch[1]);

        const users = readUsers();

        const user =
            users.find(x => x.id === id);

        if (!user) {
            return sendJSON(res, 404, {
                error: "User not found"
            });
        }

        return sendJSON(res, 200, {
            success: true,
            user,
            transactions: user.transactions || []
        });
    }

    // CHANGE BALANCE
    const balanceMatch =
        p.match(
            /^\/api\/admin\/users\/([^/]+)\/balance$/
        );

    if (
        req.method === "POST" &&
        balanceMatch
    ) {
        if (!auth(req)) {
            return sendJSON(res, 401, {
                error: "Unauthorized"
            });
        }

        try {
            const id =
                decodeURIComponent(balanceMatch[1]);

            const data = await body(req);

            const amount = Number(data.amount);

            if (!Number.isFinite(amount) || amount <= 0) {
                return sendJSON(res, 400, {
                    error: "Invalid amount"
                });
            }

            const type =
                data.type === "debit"
                    ? "debit"
                    : "credit";

            const users = readUsers();

            const user =
                users.find(x => x.id === id);

            if (!user) {
                return sendJSON(res, 404, {
                    error: "User not found"
                });
            }

            user.balance =
                Number(user.balance || 0);

            if (type === "credit") {
                user.balance += amount;
            } else {
                user.balance -= amount;

                if (user.balance < 0) {
                    user.balance = 0;
                }
            }

            if (!Array.isArray(user.transactions)) {
                user.transactions = [];
            }

            user.transactions.push({
                type,
                amount,
                reason: String(data.reason || ""),
                time: new Date().toISOString()
            });

            writeUsers(users);

            return sendJSON(res, 200, {
                success: true,
                user
            });

        } catch (error) {
            return sendJSON(res, 400, {
                error: error.message
            });
        }
    }

    // CHANGE ACCOUNT STATUS
    const statusMatch =
        p.match(
            /^\/api\/admin\/users\/([^/]+)\/status$/
        );

    if (
        req.method === "PATCH" &&
        statusMatch
    ) {
        if (!auth(req)) {
            return sendJSON(res, 401, {
                error: "Unauthorized"
            });
        }

        try {
            const id =
                decodeURIComponent(statusMatch[1]);

            const data = await body(req);

            if (
                data.status !== "active" &&
                data.status !== "suspended"
            ) {
                return sendJSON(res, 400, {
                    error: "Invalid status"
                });
            }

            const users = readUsers();

            const user =
                users.find(x => x.id === id);

            if (!user) {
                return sendJSON(res, 404, {
                    error: "User not found"
                });
            }

            user.status = data.status;

            writeUsers(users);

            return sendJSON(res, 200, {
                success: true,
                user
            });

        } catch (error) {
            return sendJSON(res, 400, {
                error: error.message
            });
        }
    }

    return sendJSON(res, 404, {
        error: "Not found"
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(
        "Noon Market ADMIN backend: http://127.0.0.1:3001"
    );
});