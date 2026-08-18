const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "CHANGE_THIS_ADMIN_PASSWORD";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ADMIN_FILE = path.join(__dirname, "admin.html");

const CUSTOMER_SERVICE =
    "https://t.me/customer_service_34";

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
}

function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, "utf8");
        const users = JSON.parse(data);
        return Array.isArray(users) ? users : [];
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
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
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
        const a = Buffer.from(hash, "hex");

        const b = crypto.scryptSync(
            password,
            salt,
            64
        );

        return (
            a.length === b.length &&
            crypto.timingSafeEqual(a, b)
        );
    } catch {
        return false;
    }
}

function publicUser(user) {
    return {
        id: user.id,
        customerId: user.customerId || "",
        email: user.email || "",
        phone: user.phone || "",
        balance: Number(user.balance || 0),
        status: user.status || "active",
        createdAt: user.createdAt || "",
        transactions:
            Array.isArray(user.transactions)
                ? user.transactions
                : []
    };
}

function makeCustomerId() {
    return (
        "NM-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()
    );
}

function ensureUser(user) {

    if (!user.id) {
        user.id = crypto.randomUUID();
    }

    if (!user.customerId) {
        user.customerId = makeCustomerId();
    }

    if (!user.status) {
        user.status = "active";
    }

    if (!Number.isFinite(Number(user.balance))) {
        user.balance = 0;
    }

    user.balance = Number(user.balance);

    if (!Array.isArray(user.transactions)) {
        user.transactions = [];
    }

    if (!user.createdAt) {
        user.createdAt =
            new Date().toISOString();
    }

    return user;
}

function normalizeUsers() {
    const users =
        readUsers().map(ensureUser);

    writeUsers(users);

    return users;
}

async function market() {

    try {

        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd&include_24hr_change=true"
        );

        if (!response.ok) {
            throw new Error("Market unavailable");
        }

        const data = await response.json();

        return {
            btc: {
                price:
                    Number(data.bitcoin?.usd || 0),
                change24h:
                    Number(
                        data.bitcoin
                            ?.usd_24h_change || 0
                    )
            },

            usdt: {
                price:
                    Number(data.tether?.usd || 0),
                change24h:
                    Number(
                        data.tether
                            ?.usd_24h_change || 0
                    )
            },

            updatedAt:
                new Date().toISOString()
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

            updatedAt:
                new Date().toISOString()
        };
    }
}

const userSessions = new Map();
const adminSessions = new Set();

function createToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function getAuthToken(req) {

    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return "";
    }

    return header.slice(7);
}

function getUserFromRequest(req) {

    const token = getAuthToken(req);

    const session =
        userSessions.get(token);

    if (!session) {
        return null;
    }

    const users = normalizeUsers();

    return users.find(
        user => user.id === session.userId
    ) || null;
}

function isAdmin(req) {

    const token =
        getAuthToken(req);

    return adminSessions.has(token);
}

function customerPage() {

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
box-sizing:border-box
}

body{
margin:0;
background:#f5f6f8;
color:#101828;
font-family:Arial,sans-serif
}

header{
height:70px;
background:#fff;
border-bottom:1px solid #eee;
display:flex;
align-items:center;
justify-content:space-between;
padding:0 20px
}

.logo{
font-size:24px;
font-weight:800
}

.container{
max-width:760px;
margin:auto;
padding:20px
}

.login{
min-height:100vh;
display:grid;
place-items:center;
padding:20px
}

.box,
.card,
.coin,
.plan,
.records{
background:#fff;
border-radius:20px;
padding:20px;
box-shadow:0 5px 20px rgba(0,0,0,.05)
}

.login .box{
width:min(430px,100%)
}

input{
width:100%;
padding:14px;
margin:7px 0;
border:1px solid #d0d5dd;
border-radius:12px;
font-size:15px
}

button{
cursor:pointer
}

.btn{
width:100%;
padding:14px;
border:0;
border-radius:13px;
background:#111827;
color:#fff;
font-weight:700;
margin-top:8px
}

.secondary{
background:#fff;
color:#111827;
border:1px solid #ddd
}

.muted{
color:#667085
}

.balance{
background:#111827;
color:#fff;
border-radius:23px;
padding:24px;
margin-bottom:15px
}

.balance strong{
display:block;
font-size:35px;
margin:8px 0
}

.market{
display:grid;
grid-template-columns:1fr 1fr;
gap:12px
}

.price{
font-size:23px;
font-weight:800;
margin-top:9px
}

.actions{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:10px;
margin:15px 0
}

.action{
border:0;
background:#fff;
border-radius:17px;
padding:17px 5px;
font-weight:700
}

.bottom{
position:fixed;
left:0;
right:0;
bottom:0;
height:68px;
background:#fff;
border-top:1px solid #eee;
display:flex;
justify-content:space-around;
align-items:center
}

.nav{
border:0;
background:none;
padding:10px;
font-weight:600
}

.plan{
display:flex;
justify-content:space-between;
align-items:center;
margin:10px 0
}

.record{
display:flex;
justify-content:space-between;
padding:14px 0;
border-bottom:1px solid #eee
}

@media(max-width:600px){

.market{
grid-template-columns:1fr
}

.actions{
grid-template-columns:1fr 1fr 1fr
}

}

</style>

</head>

<body>

<div id="root"></div>

<script>

let currentUser = null;
let userToken = "";

const root =
document.getElementById("root");

const money =
n => "$" +
Number(n || 0).toFixed(2);

function showLogin(){

root.innerHTML = \`
<main class="login">

<section class="box">

<h1>Noon Market</h1>

<p class="muted">
Secure account access
</p>

<input
id="loginIdentifier"
placeholder="Email address or phone number"
>

<input
id="loginPassword"
type="password"
placeholder="Password"
>

<button
class="btn"
onclick="signIn()"
>
Sign In
</button>

<button
class="btn secondary"
onclick="showRegister()"
>
Create Account
</button>

<p
id="loginMessage"
class="muted"
></p>

</section>

</main>
\`;

}

function showRegister(){

root.innerHTML = \`
<main class="login">

<section class="box">

<h1>Create Account</h1>

<p class="muted">
Open your Noon Market account
</p>

<input
id="regEmail"
type="email"
placeholder="Email address"
>

<input
id="regPhone"
placeholder="Phone number (optional)"
>

<input
id="regPassword"
type="password"
placeholder="Password (minimum 8 characters)"
>

<button
class="btn"
onclick="registerAccount()"
>
Create Account
</button>

<button
class="btn secondary"
onclick="showLogin()"
>
Back to Sign In
</button>

<p
id="registerMessage"
class="muted"
></p>

</section>

</main>
\`;

}

async function registerAccount(){

const email =
document.getElementById("regEmail")
.value.trim();

const phone =
document.getElementById("regPhone")
.value.trim();

const password =
document.getElementById("regPassword")
.value;

if(!email && !phone){

alert(
"Enter an email or phone number."
);

return;
}

if(password.length < 8){

alert(
"Password must be at least 8 characters."
);

return;
}

try{

const response =
await fetch(
"/api/register",
{
method:"POST",
headers:{
"Content-Type":
"application/json"
},
body:JSON.stringify({
email,
phone,
password
})
}
);

const data =
await response.json();

if(!response.ok){

alert(
data.error ||
"Registration failed."
);

return;
}

alert(
"Account created successfully. Your balance is $0.00."
);

showLogin();

}catch{

alert(
"Connection error. Please try again."
);

}

}

async function signIn(){

const identifier =
document
.getElementById("loginIdentifier")
.value.trim();

const password =
document
.getElementById("loginPassword")
.value;

if(!identifier){

alert(
"Enter your email or phone number."
);

return;
}

if(!password){

alert(
"Enter your password."
);

return;
}

try{

const response =
await fetch(
"/api/login",
{
method:"POST",
headers:{
"Content-Type":
"application/json"
},
body:JSON.stringify({
identifier,
password
})
}
);

const data =
await response.json();

if(!response.ok){

alert(
data.error ||
"Invalid login."
);

return;
}

userToken =
data.token;

currentUser =
data.user;

localStorage.setItem(
"nm_token",
userToken
);

localStorage.setItem(
"nm_user",
JSON.stringify(currentUser)
);

home();

}catch{

alert(
"Connection error. Please try again."
);

}

}

async function refreshUser(){

if(!userToken){
return false;
}

try{

const response =
await fetch(
"/api/me",
{
headers:{
Authorization:
"Bearer " + userToken
}
}
);

if(!response.ok){
return false;
}

const data =
await response.json();

if(data.role !== "user"){
return false;
}

currentUser =
data.user;

localStorage.setItem(
"nm_user",
JSON.stringify(currentUser)
);

return true;

}catch{

return false;

}

}

function shell(content){

root.innerHTML = \`

<div>

<header>

<b class="logo">
Noon Market
</b>

<button
onclick="logout()"
>
Sign Out
</button>

</header>

<main class="container">

\${content}

</main>

<nav class="bottom">

<button
class="nav"
onclick="home()"
>
Home
</button>

<button
class="nav"
onclick="service()"
>
Service
</button>

<button
class="nav"
onclick="plans()"
>
Our Plans
</button>

<button
class="nav"
onclick="records()"
>
Records
</button>

<button
class="nav"
onclick="account()"
>
Account
</button>

</nav>

</div>

\`;

}

async function home(){

await refreshUser();

if(!currentUser){

logout();
return;

}

shell(\`

<div class="balance">

<small>
Available Balance
</small>

<strong>
\${money(currentUser.balance)}
</strong>

<small>
\${currentUser.email ||
currentUser.phone ||
""}
</small>

</div>

<section class="market">

<div class="coin">

<b>BTC / USD</b>

<div
id="btcPrice"
class="price"
>
Loading...
</div>

<small
id="btcChange"
>
—
</small>

</div>

<div class="coin">

<b>USDT / USD</b>

<div
id="usdtPrice"
class="price"
>
Loading...
</div>

<small
id="usdtChange"
>
—
</small>

</div>

</section>

<section class="actions">

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

</section>

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

document.getElementById(
"btcPrice"
).textContent =
money(data.btc.price);

document.getElementById(
"usdtPrice"
).textContent =
money(data.usdt.price);

document.getElementById(
"btcChange"
).textContent =
Number(data.btc.change24h)
.toFixed(2) +
"% / 24h";

document.getElementById(
"usdtChange"
).textContent =
Number(data.usdt.change24h)
.toFixed(2) +
"% / 24h";

}catch{

document.getElementById(
"btcPrice"
).textContent =
"Unavailable";

document.getElementById(
"usdtPrice"
).textContent =
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
href="${CUSTOMER_SERVICE}"
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
<b>
Starter Plan
</b>

<div class="muted">
$50 — 7%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
Standard Plan
</b>

<div class="muted">
$100 — 9%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
Growth Plan
</b>

<div class="muted">
$500 — 11%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
Premium Plan
</b>

<div class="muted">
$1,000 — 13.5%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
Business Plan
</b>

<div class="muted">
$10,000 — 15%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
VIP Plan
</b>

<div class="muted">
$20,000 — 17%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
Elite Plan
</b>

<div class="muted">
$50,000 — 18.5%
</div>

</div>

<button>
View
</button>

</div>

<div class="plan">

<div>
<b>
Premium Elite
</b>

<div class="muted">
$100,000 — 20%
</div>

</div>

<button>
View
</button>

</div>

\`);

}

function records(){

const records =
Array.isArray(
currentUser.transactions
)
? currentUser.transactions
: [];

let html =
records.map(t => \`

<div class="record">

<span>

<b>
\${t.type}
</b>

<br>

<small>
\${new Date(t.time)
.toLocaleString()}
</small>

<br>

<small>
\${t.reason || ""}
</small>

</span>

<b>
\${money(t.amount)}
</b>

</div>

\`).join("");

if(!html){

html =
"<p class='muted'>No transactions yet.</p>";

}

shell(\`

<h2>
Records
</h2>

<div class="records">
\${html}
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
<b>
Customer ID:
</b>
\${currentUser.customerId || ""}
</p>

<p>
<b>
Email:
</b>
\${currentUser.email || "—"}
</p>

<p>
<b>
Phone:
</b>
\${currentUser.phone || "—"}
</p>

<p>
<b>
Available Balance:
</b>
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

userToken = "";

currentUser = null;

localStorage.removeItem(
"nm_token"
);

localStorage.removeItem(
"nm_user"
);

showLogin();

}

async function start(){

userToken =
localStorage.getItem(
"nm_token"
) || "";

if(userToken){

const ok =
await refreshUser();

if(ok){

home();
return;

}

}

showLogin();

}

start();

</script>

</body>

</html>`;
}

const server =
http.createServer(
async (req, res) => {

    if (req.method === "OPTIONS") {
        return sendJSON(res, 204, {});
    }

    const url =
        new URL(
            req.url,
            "http://localhost"
        );

    const p = url.pathname;

    try {

        // CUSTOMER WEBSITE

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

            return res.end(
                customerPage()
            );
        }

        // ADMIN PAGE

        if (
            req.method === "GET" &&
            (
                p === "/admin.html" ||
                p === "/admin"
            )
        ) {

            if (!fs.existsSync(ADMIN_FILE)) {

                return sendJSON(
                    res,
                    404,
                    {
                        error:
                            "admin.html not found"
                    }
                );
            }

            res.writeHead(200, {
                "Content-Type":
                    "text/html; charset=utf-8",
                "Cache-Control":
                    "no-store"
            });

            return res.end(
                fs.readFileSync(
                    ADMIN_FILE,
                    "utf8"
                )
            );
        }

        // MARKET

        if (
            req.method === "GET" &&
            p === "/api/market"
        ) {

            return sendJSON(
                res,
                200,
                await market()
            );
        }

        // CONFIG

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

        // REGISTER

        if (
            req.method === "POST" &&
            p === "/api/register"
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

            const users =
                normalizeUsers();

            const exists =
                users.some(user =>
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
                hashPassword(password);

            const user = {
                id:
                    crypto.randomUUID(),

                customerId:
                    makeCustomerId(),

                email:
                    email || "",

                phone:
                    phone || "",

                passwordHash:
                    passwordData.hash,

                passwordSalt:
                    passwordData.salt,

                balance: 0,

                status:
                    "active",

                transactions: [],

                createdAt:
                    new Date().toISOString()
            };

            users.push(user);

            writeUsers(users);

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

        // CUSTOMER LOGIN

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

            const password =
                String(
                    data.password || ""
                );

            const users =
                normalizeUsers();

            const user =
                users.find(u =>
                    (
                        u.email &&
                        u.email.toLowerCase() ===
                            identifier.toLowerCase()
                    ) ||
                    (
                        u.phone &&
                        u.phone === identifier
                    )
                );

            if (!user) {

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
                !user.passwordHash ||
                !user.passwordSalt
            ) {

                return sendJSON(
                    res,
                    401,
                    {
                        error:
                            "This account needs to be recreated"
                    }
                );
            }

            if (
                !verifyPassword(
                    password,
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
                user.status !== "active"
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
                createToken();

            userSessions.set(
                token,
                {
                    userId: user.id
                }
            );

            return sendJSON(
                res,
                200,
                {
                    success: true,
                    token,
                    user:
                        publicUser(user)
                }
            );
        }

        // CURRENT CUSTOMER

        if (
            req.method === "GET" &&
            p === "/api/me"
        ) {

            const user =
                getUserFromRequest(req);

            if (!user) {

                return sendJSON(
                    res,
                    401,
                    {
                        error:
                            "Unauthorized"
                    }
                );
            }

            return sendJSON(
                res,
                200,
                {
                    role: "user",
                    user:
                        publicUser(user)
                }
            );
        }

        // ADMIN LOGIN

        if (
            req.method === "POST" &&
            p === "/api/admin/login"
        ) {

            const data =
                await getBody(req);

            const username =
                String(
                    data.username || ""
                );

            const password =
                String(
                    data.password || ""
                );

            if (
                username !== ADMIN_USER ||
                password !== ADMIN_PASSWORD
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
                createToken();

            adminSessions.add(token);

            return sendJSON(
                res,
                200,
                {
                    success: true,
                    token
                }
            );
        }

        // ADMIN USERS LIST

        if (
            req.method === "GET" &&
            p === "/api/admin/users"
        ) {

            if (!isAdmin(req)) {

                return sendJSON(
                    res,
                    401,
                    {
                        error:
                            "Unauthorized"
                    }
                );
            }

            const q =
                String(
                    url.searchParams.get("q") ||
                    ""
                )
                .toLowerCase()
                .trim();

            const users =
                normalizeUsers();

            const filtered =
                users.filter(user => {

                    if (!q) {
                        return true;
                    }

                    return [
                        user.email,
                        user.phone,
                        user.id,
                        user.customerId
                    ]
                    .filter(Boolean)
                    .some(value =>
                        String(value)
                            .toLowerCase()
                            .includes(q)
                    );
                });

            return sendJSON(
                res,
                200,
                {
                    success: true,
                    users:
                        filtered.map(
                            publicUser
                        )
                }
            );
        }

        // ADMIN SINGLE USER

        let match =
            p.match(
                /^\/api\/admin\/users\/([^/]+)$/
            );

        if (
            req.method === "GET" &&
            match
        ) {

            if (!isAdmin(req)) {

                return sendJSON(
                    res,
                    401,
                    {
                        error:
                            "Unauthorized"
                    }
                );
            }

            const users =
                normalizeUsers();

            const user =
                users.find(
                    u =>
                        u.id === match[1]
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
                        publicUser(user),
                    transactions:
                        user.transactions || []
                }
            );
        }

        // ADMIN BALANCE

        match =
            p.match(
                /^\/api\/admin\/users\/([^/]+)\/balance$/
            );

        if (
            req.method === "POST" &&
            match
        ) {

            if (!isAdmin(req)) {

                return sendJSON(
                    res,
                    401,
                    {
                        error:
                            "Unauthorized"
                    }
                );
            }

            const data =
                await getBody(req);

            const type =
                data.type === "debit"
                    ? "debit"
                    : "credit";

            const amount =
                Number(data.amount);

            const reason =
                String(
                    data.reason || ""
                ).trim();

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                return sendJSON(
                    res,
                    400,
                    {
                        error:
                            "Enter a valid amount"
                    }
                );
            }

            const users =
                normalizeUsers();

            const user =
                users.find(
                    u =>
                        u.id === match[1]
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

            if (
                type === "debit" &&
                Number(user.balance) < amount
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

            if (type === "credit") {

                user.balance =
                    Number(user.balance) +
                    amount;

            } else {

                user.balance =
                    Number(user.balance) -
                    amount;
            }

            user.balance =
                Number(
                    user.balance.toFixed(2)
                );

            const transaction = {

                id:
                    crypto.randomUUID(),

                type:
                    type === "credit"
                        ? "Credit"
                        : "Debit",

                amount:
                    type === "credit"
                        ? amount
                        : -amount,

                reason,

                time:
                    new Date().toISOString(),

                actor:
                    "admin"
            };

            user.transactions.push(
                transaction
            );

            writeUsers(users);

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

        // ADMIN STATUS

        match =
            p.match(
                /^\/api\/admin\/users\/([^/]+)\/status$/
            );

        if (
            req.method === "PATCH" &&
            match
        ) {

            if (!isAdmin(req)) {

                return sendJSON(
                    res,
                    401,
                    {
                        error:
                            "Unauthorized"
                    }
                );
            }

            const data =
                await getBody(req);

            const status =
                data.status === "suspended"
                    ? "suspended"
                    : "active";

            const users =
                normalizeUsers();

            const user =
                users.find(
                    u =>
                        u.id === match[1]
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

            user.status = status;

            writeUsers(users);

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
            "Noon Market running on port " +
            PORT
        );

        console.log(
            "Admin: /admin.html"
        );

    }
);
