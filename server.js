const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

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
        const data = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        return Array.isArray(data) ? data : [];
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

function json(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
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

function publicUser(user) {
    return {
        id: user.id,
        email: user.email || "",
        phone: user.phone || "",
        balance: Number(user.balance || 0),
        status: user.status || "active",
        createdAt: user.createdAt || "",
        transactions: Array.isArray(user.transactions)
            ? user.transactions
            : []
    };
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return {
        salt,
        hash
    };
}

function verifyPassword(password, salt, hash) {
    try {
        const calculated = crypto.scryptSync(
            password,
            salt,
            64
        );

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            calculated
        );
    } catch {
        return false;
    }
}

const sessions = new Map();

async function market() {
    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd&include_24hr_change=true"
        );

        if (!response.ok) {
            throw new Error("Market request failed");
        }

        const data = await response.json();

        return {
            btc: {
                price: Number(data.bitcoin?.usd || 0),
                change24h: Number(
                    data.bitcoin?.usd_24h_change || 0
                )
            },

            usdt: {
                price: Number(data.tether?.usd || 0),
                change24h: Number(
                    data.tether?.usd_24h_change || 0
                )
            },

            updatedAt: new Date().toISOString()
        };
    } catch {
        return {
            btc: {
                price: 0,
                change24h: 0
            },

            usdt: {
                price: 1,
                change24h: 0
            },

            updatedAt: new Date().toISOString()
        };
    }
}

function page() {
    return `<!doctype html>
<html lang="en">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>Noon Market</title>

<style>

*{
box-sizing:border-box;
}

body{
margin:0;
font-family:Arial,sans-serif;
background:#f5f7fa;
color:#111827;
}

button,
input{
font:inherit;
}

button{
cursor:pointer;
}

.login{
min-height:100vh;
display:flex;
align-items:center;
justify-content:center;
padding:20px;
}

.login-box{
width:100%;
max-width:430px;
background:white;
padding:30px;
border-radius:24px;
box-shadow:0 15px 45px rgba(0,0,0,.08);
}

.logo{
font-size:30px;
font-weight:800;
margin-bottom:8px;
}

.subtitle{
color:#667085;
margin-bottom:25px;
}

input{
width:100%;
padding:14px;
margin-bottom:12px;
border:1px solid #d0d5dd;
border-radius:12px;
outline:none;
}

input:focus{
border-color:#111827;
}

.btn{
width:100%;
padding:14px;
border:0;
border-radius:12px;
background:#111827;
color:white;
font-weight:700;
}

.secondary{
background:#eef0f3;
color:#111827;
margin-top:10px;
}

.error{
color:#b42318;
margin-top:12px;
}

.app{
min-height:100vh;
padding-bottom:85px;
}

.topbar{
height:70px;
background:white;
border-bottom:1px solid #e5e7eb;
display:flex;
align-items:center;
justify-content:space-between;
padding:0 20px;
position:sticky;
top:0;
z-index:10;
}

.top-logo{
font-size:24px;
font-weight:800;
}

.logout{
border:0;
background:#f1f2f4;
padding:9px 14px;
border-radius:10px;
}

.container{
max-width:760px;
margin:auto;
padding:20px;
}

.balance{
background:#111827;
color:white;
border-radius:24px;
padding:25px;
margin-bottom:15px;
}

.balance-label{
opacity:.75;
}

.balance-value{
font-size:38px;
font-weight:800;
margin:8px 0;
}

.market{
display:grid;
grid-template-columns:1fr 1fr;
gap:12px;
}

.card{
background:white;
border-radius:20px;
padding:20px;
box-shadow:0 5px 20px rgba(0,0,0,.04);
margin-bottom:15px;
}

.price{
font-size:24px;
font-weight:800;
margin:8px 0;
}

.muted{
color:#667085;
}

.actions{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:10px;
margin:15px 0;
}

.action{
border:0;
background:white;
padding:18px 8px;
border-radius:17px;
font-weight:700;
box-shadow:0 5px 20px rgba(0,0,0,.04);
}

.bottom{
position:fixed;
bottom:0;
left:0;
right:0;
height:70px;
background:white;
border-top:1px solid #e5e7eb;
display:flex;
justify-content:space-around;
align-items:center;
z-index:20;
}

.nav{
border:0;
background:none;
font-size:13px;
}

.plan{
background:white;
border-radius:17px;
padding:18px;
margin-bottom:10px;
display:flex;
justify-content:space-between;
align-items:center;
}

.plan button{
border:0;
background:#111827;
color:white;
padding:9px 13px;
border-radius:10px;
}

.record{
display:flex;
justify-content:space-between;
padding:14px 0;
border-bottom:1px solid #eee;
}

@media(max-width:600px){

.market{
grid-template-columns:1fr;
}

.actions{
grid-template-columns:repeat(3,1fr);
}

.container{
padding:15px;
}

}

</style>

</head>

<body>

<div id="root"></div>

<script>

let currentUser =
JSON.parse(
localStorage.getItem("noon_market_user") || "null"
);

let authToken =
localStorage.getItem("noon_market_token") || "";

const money = value =>
"$" + Number(value || 0).toFixed(2);

function showLogin(){

root.innerHTML = \`
<div class="login">

<div class="login-box">

<div class="logo">
Noon Market
</div>

<div class="subtitle">
Secure account access
</div>

<input
id="identifier"
placeholder="Email address or phone number"
>

<input
id="password"
type="password"
placeholder="Password"
>

<button
class="btn"
onclick="loginUser()"
>
Sign In
</button>

<button
class="btn secondary"
onclick="showRegister()"
>
Create Account
</button>

<div id="loginError"></div>

</div>

</div>
\`;

}

function showRegister(){

root.innerHTML = \`
<div class="login">

<div class="login-box">

<div class="logo">
Noon Market
</div>

<div class="subtitle">
Create your account
</div>

<input
id="regEmail"
type="email"
placeholder="Email address"
>

<input
id="regPhone"
placeholder="Phone number"
>

<input
id="regPassword"
type="password"
placeholder="Password"
>

<button
class="btn"
onclick="registerUser()"
>
Create Account
</button>

<button
class="btn secondary"
onclick="showLogin()"
>
Back to Sign In
</button>

<div id="regError"></div>

</div>

</div>
\`;

}

async function loginUser(){

const identifier =
document.getElementById("identifier").value.trim();

const password =
document.getElementById("password").value;

if(!identifier || !password){

document.getElementById("loginError").innerHTML =
'<p class="error">Enter your login details.</p>';

return;
}

try{

const response =
await fetch("/api/login",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
identifier,
password
})

});

const data =
await response.json();

if(!response.ok){

document.getElementById("loginError").innerHTML =
'<p class="error">' +
(data.error || "Login failed.") +
"</p>";

return;
}

authToken = data.token;
currentUser = data.user;

localStorage.setItem(
"noon_market_token",
authToken
);

localStorage.setItem(
"noon_market_user",
JSON.stringify(currentUser)
);

home();

}catch{

document.getElementById("loginError").innerHTML =
'<p class="error">Connection error. Please try again.</p>';

}

}

async function registerUser(){

const email =
document.getElementById("regEmail").value.trim();

const phone =
document.getElementById("regPhone").value.trim();

const password =
document.getElementById("regPassword").value;

if(!email && !phone){

document.getElementById("regError").innerHTML =
'<p class="error">Enter an email or phone number.</p>';

return;
}

if(password.length < 8){

document.getElementById("regError").innerHTML =
'<p class="error">Password must be at least 8 characters.</p>';

return;
}

try{

const response =
await fetch("/api/register",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
email,
phone,
password
})

});

const data =
await response.json();

if(!response.ok){

document.getElementById("regError").innerHTML =
'<p class="error">' +
(data.error || "Registration failed.") +
"</p>";

return;
}

showLogin();

alert("Account created successfully. Please sign in.");

}catch{

document.getElementById("regError").innerHTML =
'<p class="error">Connection error. Please try again.</p>';

}

}

function shell(content){

root.innerHTML = \`

<div class="app">

<div class="topbar">

<div class="top-logo">
Noon Market
</div>

<button
class="logout"
onclick="logout()"
>
Sign Out
</button>

</div>

<div class="container">
\${content}
</div>

<div class="bottom">

<button class="nav" onclick="home()">
Home
</button>

<button class="nav" onclick="service()">
Service
</button>

<button class="nav" onclick="plans()">
Plans
</button>

<button class="nav" onclick="records()">
Records
</button>

<button class="nav" onclick="account()">
Account
</button>

</div>

</div>

\`;

}

async function home(){

shell(\`

<div class="balance">

<div class="balance-label">
Available Balance
</div>

<div class="balance-value">
\${money(currentUser.balance)}
</div>

<div>
\${currentUser.email || currentUser.phone || ""}
</div>

</div>

<div class="market">

<div class="card">

<b>BTC / USD</b>

<div id="btcPrice" class="price">
Loading...
</div>

<div id="btcChange" class="muted">
—
</div>

</div>

<div class="card">

<b>USDT / USD</b>

<div id="usdtPrice" class="price">
Loading...
</div>

<div id="usdtChange" class="muted">
—
</div>

</div>

</div>

<div class="actions">

<button
class="action"
onclick="service()"
>
Deposit
</button>

<button
class="action"
onclick="service()"
>
Withdrawal
</button>

<button
class="action"
onclick="plans()"
>
Our Plans
</button>

</div>

<div class="card">

<h3>
Customer Service
</h3>

<p class="muted">
Contact our customer service team.
</p>

<button
class="btn"
onclick="service()"
>
Customer Service
</button>

</div>

\`);

try{

const response =
await fetch("/api/market");

const data =
await response.json();

document.getElementById("btcPrice").textContent =
money(data.btc.price);

document.getElementById("usdtPrice").textContent =
money(data.usdt.price);

document.getElementById("btcChange").textContent =
data.btc.change24h.toFixed(2) + "% / 24h";

document.getElementById("usdtChange").textContent =
data.usdt.change24h.toFixed(2) + "% / 24h";

}catch{

document.getElementById("btcPrice").textContent =
"Unavailable";

document.getElementById("usdtPrice").textContent =
"Unavailable";

}

}

function service(){

shell(\`

<h2>
Customer Service
</h2>

<div class="card">

<h3>
Need assistance?
</h3>

<p class="muted">
Contact our customer service team.
</p>

<a
href="https://t.me/customer_service_34"
target="_blank"
rel="noopener"
>

<button class="btn">
Customer Service
</button>

</a>

</div>

\`);

}

function plans(){

shell(\`

<h2>
Our Plans
</h2>

<div class="plan">
<div>
<b>$50</b>
<div class="muted">
Commission 7%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$100</b>
<div class="muted">
Commission 9%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$500</b>
<div class="muted">
Commission 11%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$1,000</b>
<div class="muted">
Commission 13.5%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$10,000</b>
<div class="muted">
Commission 15%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$20,000</b>
<div class="muted">
Commission 17%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$50,000</b>
<div class="muted">
Commission 18.5%
</div>
</div>
<button>View</button>
</div>

<div class="plan">
<div>
<b>$100,000</b>
<div class="muted">
Commission 20%
</div>
</div>
<button>View</button>
</div>

\`);

}

function records(){

const records =
Array.isArray(currentUser.transactions)
? currentUser.transactions
: [];

const html =
records.map(tx => \`

<div class="record">

<div>
<b>\${tx.type}</b>
<br>
<small class="muted">
\${new Date(tx.time).toLocaleString()}
</small>
</div>

<b>
\${money(tx.amount)}
</b>

</div>

\`).join("");

shell(\`

<h2>
Records
</h2>

<div class="card">

\${html || '<p class="muted">No transactions yet.</p>'}

</div>

\`);

}

function account(){

shell(\`

<h2>
My Account
</h2>

<div class="card">

<p>
<b>Email:</b>
\${currentUser.email || "—"}
</p>

<p>
<b>Phone:</b>
\${currentUser.phone || "—"}
</p>

<p>
<b>Available Balance:</b>
\${money(currentUser.balance)}
</p>

<button
class="btn"
onclick="logout()"
>
Sign Out
</button>

</div>

\`);

}

function logout(){

localStorage.removeItem("noon_market_token");
localStorage.removeItem("noon_market_user");

authToken = "";
currentUser = null;

showLogin();

}

if(currentUser && authToken){

home();

}else{

showLogin();

}

</script>

</body>

</html>`;
}

const server = http.createServer(async (req, res) => {

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(
        req.url,
        "http://localhost"
    );

    const p = url.pathname;

    try {

        // CUSTOMER WEBSITE
        if (
            req.method === "GET" &&
            (p === "/" || p === "/index.html")
        ) {

            res.writeHead(200, {
                "Content-Type":
                    "text/html; charset=utf-8",
                "Cache-Control":
                    "no-store"
            });

            return res.end(page());
        }

        // MARKET
        if (
            req.method === "GET" &&
            p === "/api/market"
        ) {

            return json(
                res,
                200,
                await market()
            );
        }

        // REGISTER
        if (
            req.method === "POST" &&
            p === "/api/register"
        ) {

            const data = await body(req);

            const email =
                String(data.email || "")
                    .trim()
                    .toLowerCase();

            const phone =
                String(data.phone || "")
                    .trim();

            const password =
                String(data.password || "");

            if (!email && !phone) {
                return json(res, 400, {
                    error:
                        "Email or phone is required"
                });
            }

            if (password.length < 8) {
                return json(res, 400, {
                    error:
                        "Password must be at least 8 characters"
                });
            }

            const users = readUsers();

            const exists = users.find(user =>
                (email && user.email === email) ||
                (phone && user.phone === phone)
            );

            if (exists) {
                return json(res, 409, {
                    error:
                        "Account already exists"
                });
            }

            const passwordData =
                hashPassword(password);

            const user = {
                id: crypto.randomUUID(),
                email: email || "",
                phone: phone || "",
                passwordHash:
                    passwordData.hash,
                passwordSalt:
                    passwordData.salt,
                balance: 0,
                status: "active",
                transactions: [],
                createdAt:
                    new Date().toISOString()
            };

            users.push(user);

            writeUsers(users);

            return json(res, 201, {
                success: true,
                user: publicUser(user)
            });
        }

        // LOGIN
        if (
            req.method === "POST" &&
            p === "/api/login"
        ) {

            const data = await body(req);

            const identifier =
                String(
                    data.identifier || ""
                ).trim();

            const password =
                String(
                    data.password || ""
                );

            const users = readUsers();

            const user = users.find(u =>
                u.email === identifier.toLowerCase() ||
                u.phone === identifier
            );

            if (
                !user ||
                !verifyPassword(
                    password,
                    user.passwordSalt,
                    user.passwordHash
                )
            ) {

                return json(res, 401, {
                    error:
                        "Invalid email/phone or password"
                });
            }

            if (user.status === "suspended") {
                return json(res, 403, {
                    error:
                        "Account is suspended"
                });
            }

            const token =
                crypto.randomBytes(32)
                    .toString("hex");

            sessions.set(token, {
                userId: user.id
            });

            return json(res, 200, {
                success: true,
                token,
                user: publicUser(user)
            });
        }

        // CURRENT USER
        if (
            req.method === "GET" &&
            p === "/api/me"
        ) {

            const auth =
                req.headers.authorization || "";

            const token =
                auth.startsWith("Bearer ")
                    ? auth.slice(7)
                    : "";

            const session =
                sessions.get(token);

            if (!session) {
                return json(res, 401, {
                    error: "Unauthorized"
                });
            }

            const users = readUsers();

            const user =
                users.find(
                    u => u.id === session.userId
                );

            if (!user) {
                return json(res, 404, {
                    error: "User not found"
                });
            }

            return json(res, 200, {
                user: publicUser(user)
            });
        }

        // NOT FOUND
        return json(res, 404, {
            error: "Not found"
        });

    } catch (error) {

        console.error(error);

        return json(res, 500, {
            error: "Server error"
        });
    }
});

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            "Noon Market customer server running on port " +
            PORT
        );
    }
);
