const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const TG = "https://t.me/customer_service_34";

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

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
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
        throw Error("Crypto market unavailable");
    }

    const d = await r.json();

    return {
        BTC: {
            price: Number(d.bitcoin?.usd || 0),
            change: Number(d.bitcoin?.usd_24h_change || 0)
        },

        ETH: {
            price: Number(d.ethereum?.usd || 0),
            change: Number(d.ethereum?.usd_24h_change || 0)
        },

        USDT: {
            price: Number(d.tether?.usd || 0),
            change: Number(d.tether?.usd_24h_change || 0)
        },

        BNB: {
            price: Number(d.binancecoin?.usd || 0),
            change: Number(d.binancecoin?.usd_24h_change || 0)
        },

        SOL: {
            price: Number(d.solana?.usd || 0),
            change: Number(d.solana?.usd_24h_change || 0)
        },

        XRP: {
            price: Number(d.ripple?.usd || 0),
            change: Number(d.ripple?.usd_24h_change || 0)
        },

        updatedAt: new Date().toISOString()
    };
}


// ============================================================
// STOCK MARKET
// ============================================================

async function stockQuote(symbol) {

    try {

        const r = await fetch(
            "https://query1.finance.yahoo.com/v8/finance/chart/" +
            encodeURIComponent(symbol) +
            "?range=1d&interval=5m"
        );

        if (!r.ok) {
            throw Error("stock");
        }

        const d = await r.json();

        const result = d.chart?.result?.[0];

        if (!result) {
            throw Error("stock");
        }

        const meta = result.meta || {};

        const price = Number(
            meta.regularMarketPrice ||
            meta.previousClose ||
            0
        );

        const previous = Number(
            meta.previousClose ||
            0
        );

        let change = 0;

        if (previous > 0) {
            change =
                ((price - previous) / previous) * 100;
        }

        return {
            symbol,
            price,
            change
        };

    } catch {

        return {
            symbol,
            price: 0,
            change: 0
        };
    }
}


async function stockMarket() {

    const symbols = [
        "AAPL",
        "TSLA",
        "NVDA",
        "MSFT",
        "AMZN",
        "GOOGL",
        "META"
    ];

    const result = {};

    await Promise.all(
        symbols.map(async symbol => {
            result[symbol] =
                await stockQuote(symbol);
        })
    );

    return {
        ...result,
        updatedAt: new Date().toISOString()
    };
}


// ============================================================
// COMPLETE MARKET
// ============================================================

async function market() {

    const [crypto, stocks] =
        await Promise.all([
            cryptoMarket(),
            stockMarket()
        ]);

    return {
        crypto,
        stocks,
        updatedAt: new Date().toISOString()
    };
}


// ============================================================
// WEBSITE
// ============================================================

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

html{
    scroll-behavior:smooth;
}

body{
    margin:0;
    background:
        radial-gradient(
            circle at 10% 10%,
            rgba(39,255,190,.08),
            transparent 30%
        ),
        radial-gradient(
            circle at 90% 20%,
            rgba(90,100,255,.12),
            transparent 30%
        ),
        #06090f;
    color:#f5f7fa;
    font:15px Arial,sans-serif;
}

button,
input{
    font-family:inherit;
}

.app{
    min-height:100vh;
    padding-bottom:90px;
}

header{
    height:74px;
    background:rgba(8,12,20,.88);
    backdrop-filter:blur(18px);
    border-bottom:1px solid rgba(255,255,255,.08);
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 22px;
    position:sticky;
    top:0;
    z-index:50;
}

.logo{
    font-size:23px;
    font-weight:900;
    letter-spacing:-.6px;
}

.logo span{
    color:#19e6a1;
}

.header-right{
    display:flex;
    align-items:center;
    gap:10px;
}

.live-dot{
    width:8px;
    height:8px;
    border-radius:50%;
    background:#19e6a1;
    box-shadow:0 0 12px #19e6a1;
}

.live-text{
    font-size:11px;
    color:#9aa4b2;
    letter-spacing:.7px;
}

.signout{
    border:1px solid rgba(255,255,255,.1);
    background:#101620;
    color:#fff;
    border-radius:11px;
    padding:9px 13px;
    cursor:pointer;
}

.container{
    width:min(980px,100%);
    margin:auto;
    padding:24px 18px;
}

.login{
    min-height:100vh;
    display:grid;
    place-items:center;
    padding:20px;
    background:
        radial-gradient(
            circle at 50% 20%,
            rgba(25,230,161,.13),
            transparent 35%
        ),
        #06090f;
}

.login-box{
    width:min(430px,100%);
    padding:34px;
    border-radius:28px;
    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.075),
            rgba(255,255,255,.025)
        );
    border:1px solid rgba(255,255,255,.1);
    box-shadow:
        0 30px 90px rgba(0,0,0,.55),
        inset 0 1px 0 rgba(255,255,255,.08);
    backdrop-filter:blur(20px);
}

.login-logo{
    width:62px;
    height:62px;
    display:grid;
    place-items:center;
    border-radius:18px;
    background:
        linear-gradient(
            135deg,
            #19e6a1,
            #0ba77a
        );
    color:#03140f;
    font-size:27px;
    font-weight:900;
    margin-bottom:20px;
    box-shadow:0 12px 35px rgba(25,230,161,.22);
}

.login-box h1{
    font-size:31px;
    margin:0 0 7px;
    letter-spacing:-1px;
}

.login-box p{
    margin:0 0 25px;
}

input{
    width:100%;
    padding:15px 16px;
    margin:6px 0 11px;
    background:#0c121b;
    color:#fff;
    border:1px solid #202a38;
    border-radius:13px;
    outline:none;
    transition:.2s;
}

input:focus{
    border-color:#19e6a1;
    box-shadow:0 0 0 3px rgba(25,230,161,.08);
}

.btn{
    width:100%;
    padding:15px;
    border:0;
    border-radius:13px;
    background:
        linear-gradient(
            135deg,
            #19e6a1,
            #0dbb84
        );
    color:#02150f;
    font-weight:900;
    cursor:pointer;
    box-shadow:0 12px 30px rgba(25,230,161,.16);
}

.auth-switch{
    text-align:center;
    margin-top:18px;
    color:#7f8b9a;
}

.auth-switch button{
    border:0;
    background:none;
    color:#19e6a1;
    font-weight:800;
    cursor:pointer;
}

.muted{
    color:#8994a3;
}

.hero{
    position:relative;
    overflow:hidden;
    border-radius:28px;
    padding:27px;
    margin-bottom:16px;
    background:
        radial-gradient(
            circle at 90% 10%,
            rgba(25,230,161,.22),
            transparent 32%
        ),
        radial-gradient(
            circle at 15% 90%,
            rgba(91,96,255,.2),
            transparent 35%
        ),
        linear-gradient(
            135deg,
            #101923,
            #0a1018
        );
    border:1px solid rgba(255,255,255,.09);
    box-shadow:0 22px 55px rgba(0,0,0,.25);
}

.hero::after{
    content:"₮";
    position:absolute;
    right:25px;
    top:-15px;
    font-size:150px;
    font-weight:900;
    color:rgba(25,230,161,.035);
}

.hero-top{
    display:flex;
    justify-content:space-between;
    align-items:center;
    position:relative;
    z-index:2;
}

.hero-label{
    color:#9ca8b7;
    font-size:12px;
    text-transform:uppercase;
    letter-spacing:1.5px;
}

.balance{
    font-size:42px;
    font-weight:900;
    margin:8px 0;
    letter-spacing:-1.5px;
}

.account-mini{
    color:#a7b0bd;
    font-size:12px;
}

.verified{
    display:inline-flex;
    align-items:center;
    gap:6px;
    border:1px solid rgba(25,230,161,.22);
    background:rgba(25,230,161,.07);
    color:#19e6a1;
    padding:7px 10px;
    border-radius:999px;
    font-size:11px;
}

.section-title{
    display:flex;
    align-items:center;
    justify-content:space-between;
    margin:25px 2px 11px;
}

.section-title h2{
    font-size:17px;
    margin:0;
}

.section-title span{
    color:#697586;
    font-size:11px;
}

.market-grid{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:11px;
}

.market-card{
    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.065),
            rgba(255,255,255,.025)
        );
    border:1px solid rgba(255,255,255,.08);
    border-radius:19px;
    padding:17px;
    min-height:125px;
    transition:.2s;
}

.market-card:hover{
    transform:translateY(-2px);
    border-color:rgba(25,230,161,.25);
}

.coin-head{
    display:flex;
    justify-content:space-between;
    align-items:center;
}

.coin-name{
    font-weight:900;
}

.coin-symbol{
    color:#6f7b8b;
    font-size:10px;
    margin-top:3px;
}

.coin-icon{
    width:31px;
    height:31px;
    border-radius:10px;
    display:grid;
    place-items:center;
    background:#111b27;
    color:#19e6a1;
    font-weight:900;
}

.price{
    font-size:21px;
    font-weight:900;
    margin-top:15px;
}

.change{
    display:inline-block;
    margin-top:6px;
    font-size:11px;
    padding:4px 7px;
    border-radius:7px;
}

.up{
    color:#19e6a1;
    background:rgba(25,230,161,.08);
}

.down{
    color:#ff647c;
    background:rgba(255,100,124,.08);
}

.actions{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:11px;
    margin:17px 0;
}

.action{
    border:1px solid rgba(255,255,255,.08);
    background:#0d141e;
    color:#fff;
    border-radius:16px;
    padding:17px 5px;
    font-weight:800;
    cursor:pointer;
    transition:.2s;
}

.action:hover{
    background:#121c28;
    border-color:rgba(25,230,161,.25);
}

.action-icon{
    display:block;
    color:#19e6a1;
    font-size:21px;
    margin-bottom:7px;
}

.card{
    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.065),
            rgba(255,255,255,.025)
        );
    border:1px solid rgba(255,255,255,.08);
    border-radius:21px;
    padding:21px;
    box-shadow:0 12px 35px rgba(0,0,0,.14);
}

.service-card{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:20px;
}

.service-card h3{
    margin:0 0 6px;
}

.service-card p{
    margin:0;
}

.small-btn{
    border:0;
    border-radius:11px;
    padding:11px 15px;
    background:#19e6a1;
    color:#03140f;
    font-weight:900;
    cursor:pointer;
    white-space:nowrap;
}

.stock-grid{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:10px;
}

.stock-card{
    background:#0c121b;
    border:1px solid rgba(255,255,255,.07);
    border-radius:16px;
    padding:14px;
}

.stock-symbol{
    font-weight:900;
}

.stock-price{
    font-size:16px;
    font-weight:800;
    margin-top:12px;
}

.stock-change{
    font-size:10px;
    margin-top:5px;
}

.plans{
    display:grid;
    gap:12px;
}

.plan{
    position:relative;
    overflow:hidden;
    background:
        linear-gradient(
            135deg,
            rgba(255,255,255,.065),
            rgba(255,255,255,.025)
        );
    border:1px solid rgba(255,255,255,.08);
    border-radius:21px;
    padding:21px;
}

.plan.featured{
    border-color:rgba(25,230,161,.35);
}

.plan-head{
    display:flex;
    justify-content:space-between;
    align-items:center;
}

.plan-name{
    font-size:18px;
    font-weight:900;
}

.demo-tag{
    font-size:9px;
    color:#19e6a1;
    border:1px solid rgba(25,230,161,.25);
    border-radius:999px;
    padding:5px 8px;
}

.plan-rate{
    font-size:29px;
    font-weight:900;
    margin:12px 0 3px;
}

.plan-rate span{
    font-size:12px;
    color:#778293;
}

.plan-desc{
    color:#8994a3;
    font-size:12px;
    line-height:1.6;
}

.plan-button{
    margin-top:13px;
    border:0;
    background:#151e2a;
    color:#fff;
    border-radius:10px;
    padding:10px 13px;
    font-weight:800;
}

.info-list{
    display:grid;
    gap:10px;
}

.info-item{
    padding:15px;
    border-radius:15px;
    background:#0c121b;
    border:1px solid rgba(255,255,255,.06);
}

.info-item b{
    display:block;
    margin-bottom:5px;
}

.records{
    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.06),
            rgba(255,255,255,.025)
        );
    border:1px solid rgba(255,255,255,.08);
    border-radius:21px;
    padding:20px;
}

.record{
    display:flex;
    justify-content:space-between;
    gap:15px;
    padding:15px 0;
    border-bottom:1px solid rgba(255,255,255,.06);
}

.record:last-child{
    border-bottom:0;
}

.record-type{
    font-weight:900;
}

.record-info{
    color:#7e8998;
    font-size:11px;
    margin-top:4px;
}

.record-amount{
    font-weight:900;
    white-space:nowrap;
}

.bottom{
    position:fixed;
    bottom:0;
    left:0;
    right:0;
    height:74px;
    background:rgba(7,11,17,.94);
    backdrop-filter:blur(18px);
    border-top:1px solid rgba(255,255,255,.08);
    display:flex;
    justify-content:space-around;
    align-items:center;
    z-index:100;
}

.nav{
    border:0;
    background:none;
    color:#667283;
    cursor:pointer;
    font-size:11px;
    min-width:60px;
}

.nav-icon{
    display:block;
    font-size:19px;
    margin-bottom:3px;
}

.nav:hover{
    color:#19e6a1;
}

.page-title{
    font-size:28px;
    margin:5px 0 20px;
}

.notice{
    border-left:3px solid #19e6a1;
    padding:13px 15px;
    background:rgba(25,230,161,.05);
    color:#a4afbd;
    border-radius:0 12px 12px 0;
    font-size:12px;
    line-height:1.6;
    margin-bottom:15px;
}

.account-row{
    display:flex;
    justify-content:space-between;
    padding:16px 0;
    border-bottom:1px solid rgba(255,255,255,.06);
}

.account-row:last-child{
    border-bottom:0;
}

@media(max-width:760px){

    .market-grid{
        grid-template-columns:repeat(2,1fr);
    }

    .stock-grid{
        grid-template-columns:repeat(2,1fr);
    }
}

@media(max-width:560px){

    header{
        padding:0 15px;
    }

    .container{
        padding:17px 13px;
    }

    .login-box{
        padding:25px;
    }

    .balance{
        font-size:35px;
    }

    .market-grid{
        grid-template-columns:1fr 1fr;
    }

    .actions{
        grid-template-columns:repeat(3,1fr);
    }

    .service-card{
        align-items:flex-start;
        flex-direction:column;
    }

    .small-btn{
        width:100%;
    }

    .stock-grid{
        grid-template-columns:1fr 1fr;
    }
}

@media(max-width:380px){

    .market-grid{
        grid-template-columns:1fr;
    }

    .stock-grid{
        grid-template-columns:1fr 1fr;
    }

    .logo{
        font-size:20px;
    }
}

</style>

</head>

<body>

<div id="root"></div>

<script>

const TG=${JSON.stringify(TG)};

let u=JSON.parse(
    localStorage.getItem("nm_user") || "null"
);

let authMode="login";

const money=n =>
    "$"+Number(n||0).toLocaleString(
        undefined,
        {
            minimumFractionDigits:2,
            maximumFractionDigits:2
        }
    );


// ============================================================
// REFRESH USER
// ============================================================

async function refreshUser(){

    if(!u || !u.id){
        return false;
    }

    try{

        const response=await fetch(
            "/api/users/"+
            encodeURIComponent(u.id)+
            "?t="+Date.now(),
            {
                cache:"no-store"
            }
        );

        if(!response.ok){
            return false;
        }

        const data=await response.json();

        if(!data.user){
            return false;
        }

        u={
            id:data.user.id,
            email:data.user.email||"",
            phone:data.user.phone||"",
            balance:Number(data.user.balance||0),
            status:data.user.status||"active",
            records:data.user.transactions||[]
        };

        localStorage.setItem(
            "nm_user",
            JSON.stringify(u)
        );

        return true;

    }catch(error){

        console.error(error);

        return false;
    }
}


// ============================================================
// LOGIN
// ============================================================

function login(){

    authMode="login";

    root.innerHTML=

    '<main class="login">'+

    '<section class="login-box">'+

    '<div class="login-logo">₮</div>'+

    '<h1 id="authTitle">Noon Market</h1>'+

    '<p class="muted" id="authSubtitle">'+
    'Secure account access'+
    '</p>'+

    '<input id="email" type="text" '+
    'placeholder="Email address">'+

    '<input id="phone" '+
    'placeholder="Phone number (optional)">'+

    '<input id="pass" type="password" '+
    'placeholder="Password">'+

    '<button class="btn" '+
    'onclick="submitAuth()">'+
    'Login'+
    '</button>'+

    '<div class="auth-switch">'+

    '<span id="authSwitchText">'+
    "Don't have an account? "+
    '</span>'+

    '<button onclick="toggleAuth()">'+
    'Create Account'+
    '</button>'+

    '</div>'+

    '</section>'+

    '</main>';
}


function toggleAuth(){

    const title=
        document.getElementById("authTitle");

    const subtitle=
        document.getElementById("authSubtitle");

    const button=
        document.querySelector(".login-box > .btn");

    const switchText=
        document.getElementById("authSwitchText");

    const switchButton=
        document.querySelector(".auth-switch button");

    if(authMode==="login"){

        authMode="register";

        title.textContent="Create Account";

        subtitle.textContent=
            "Create your Noon Market account";

        button.textContent="Create Account";

        switchText.textContent=
            "Already have an account? ";

        switchButton.textContent="Login";

    }else{

        authMode="login";

        title.textContent="Noon Market";

        subtitle.textContent=
            "Secure account access";

        button.textContent="Login";

        switchText.textContent=
            "Don't have an account? ";

        switchButton.textContent="Create Account";
    }
}


// ============================================================
// AUTH
// ============================================================

async function submitAuth(){

    const e=
        document.getElementById("email")
        .value.trim().toLowerCase();

    const ph=
        document.getElementById("phone")
        .value.trim();

    const pw=
        document.getElementById("pass")
        .value;

    if(!e&&!ph){
        return alert(
            "Enter an email or phone number."
        );
    }

    if(!pw){
        return alert(
            "Enter your password."
        );
    }

    try{

        const endpoint=
            authMode==="register"
                ? "/api/users"
                : "/api/login";

        const response=
            await fetch(
                endpoint,
                {
                    method:"POST",
                    headers:{
                        "Content-Type":
                            "application/json"
                    },
                    body:JSON.stringify({
                        email:e,
                        phone:ph,
                        password:pw
                    })
                }
            );

        const data=
            await response.json();

        if(!response.ok){
            return alert(
                data.error ||
                "Something went wrong."
            );
        }

        u={
            id:data.user.id,
            email:data.user.email||"",
            phone:data.user.phone||"",
            balance:Number(
                data.user.balance||0
            ),
            status:data.user.status||"active",
            records:
                data.user.transactions||[]
        };

        localStorage.setItem(
            "nm_user",
            JSON.stringify(u)
        );

        await home();

    }catch(error){

        console.error(error);

        alert(
            "Backend connection failed."
        );
    }
}


// ============================================================
// SHELL
// ============================================================

function shell(content){

    root.innerHTML=

    '<div class="app">'+

    '<header>'+

    '<b class="logo">'+
    'NOON <span>MARKET</span>'+
    '</b>'+

    '<div class="header-right">'+

    '<span class="live-dot"></span>'+

    '<span class="live-text">MARKET LIVE</span>'+

    '<button class="signout" '+
    'onclick="logout()">Sign Out</button>'+

    '</div>'+

    '</header>'+

    '<main class="container">'+
    content+
    '</main>'+

    '<nav class="bottom">'+

    '<button class="nav" onclick="home()">'+
    '<span class="nav-icon">⌂</span>Home'+
    '</button>'+

    '<button class="nav" onclick="service()">'+
    '<span class="nav-icon">◉</span>Service'+
    '</button>'+

    '<button class="nav" onclick="plans()">'+
    '<span class="nav-icon">◆</span>Plans'+
    '</button>'+

    '<button class="nav" onclick="records()">'+
    '<span class="nav-icon">▤</span>Records'+
    '</button>'+

    '<button class="nav" onclick="account()">'+
    '<span class="nav-icon">◎</span>Account'+
    '</button>'+

    '</nav>'+

    '</div>';
}


// ============================================================
// FORMAT CHANGE
// ============================================================

function changeHTML(change){

    const n=Number(change||0);

    const cls=n>=0?"up":"down";

    const sign=n>=0?"+":"";

    return '<span class="change '+
        cls+'">'+
        sign+
        n.toFixed(2)+
        '%</span>';
}


// ============================================================
// HOME
// ============================================================

async function home(){

    await refreshUser();

    if(!u){
        return login();
    }

    shell(

    '<section class="hero">'+

    '<div class="hero-top">'+

    '<div>'+
    '<div class="hero-label">Available Balance</div>'+
    '<div class="balance">'+
    money(u.balance)+
    '</div>'+
    '<div class="account-mini">'+
    (u.email||u.phone)+
    '</div>'+
    '</div>'+

    '<div class="verified">● ACTIVE</div>'+

    '</div>'+

    '</section>'+

    '<div class="section-title">'+
    '<h2>Crypto Market</h2>'+
    '<span>LIVE MARKET DATA</span>'+
    '</div>'+

    '<section class="market-grid">'+

    cryptoCard("BTC","Bitcoin","₿","btc")+
    cryptoCard("ETH","Ethereum","Ξ","eth")+
    cryptoCard("USDT","Tether","₮","usdt")+
    cryptoCard("BNB","BNB","B","bnb")+
    cryptoCard("SOL","Solana","S","sol")+
    cryptoCard("XRP","XRP","X","xrp")+

    '</section>'+

    '<section class="actions">'+

    '<button class="action" onclick="service()">'+
    '<span class="action-icon">＋</span>'+
    'Deposit'+
    '</button>'+

    '<button class="action" onclick="service()">'+
    '<span class="action-icon">↗</span>'+
    'Withdrawal'+
    '</button>'+

    '<button class="action" onclick="plans()">'+
    '<span class="action-icon">◆</span>'+
    'Plans'+
    '</button>'+

    '</section>'+

    '<div class="section-title">'+
    '<h2>Market Watch</h2>'+
    '<span>STOCKS</span>'+
    '</div>'+

    '<section class="stock-grid">'+

    stockCard("AAPL","Apple")+
    stockCard("TSLA","Tesla")+
    stockCard("NVDA","NVIDIA")+
    stockCard("MSFT","Microsoft")+
    stockCard("AMZN","Amazon")+
    stockCard("GOOGL","Alphabet")+
    stockCard("META","Meta")+

    '</section>'+

    '<div style="height:10px"></div>'+

    '<div class="card service-card">'+

    '<div>'+
    '<h3>Customer Service</h3>'+
    '<p class="muted">Need assistance? Our support channel is available here.</p>'+
    '</div>'+

    '<button class="small-btn" onclick="service()">'+
    'Contact Support'+
    '</button>'+

    '</div>'

    );


    try{

        const response=
            await fetch(
                "/api/market?t="+Date.now(),
                {
                    cache:"no-store"
                }
            );

        const d=
            await response.json();


        const crypto=d.crypto||{};


        updateCrypto(
            "btc",
            crypto.BTC
        );

        updateCrypto(
            "eth",
            crypto.ETH
        );

        updateCrypto(
            "usdt",
            crypto.USDT
        );

        updateCrypto(
            "bnb",
            crypto.BNB
        );

        updateCrypto(
            "sol",
            crypto.SOL
        );

        updateCrypto(
            "xrp",
            crypto.XRP
        );


        const stocks=d.stocks||{};

        Object.keys(stocks).forEach(
            symbol=>{
                updateStock(
                    symbol,
                    stocks[symbol]
                );
            }
        );

    }catch(error){

        console.error(
            "Market error:",
            error
        );
    }
}


function cryptoCard(
    symbol,
    name,
    icon,
    id
){

    return (

    '<div class="market-card">'+

    '<div class="coin-head">'+

    '<div>'+
    '<div class="coin-name">'+
    name+
    '</div>'+
    '<div class="coin-symbol">'+
    symbol+
    ' / USD</div>'+
    '</div>'+

    '<div class="coin-icon">'+
    icon+
    '</div>'+

    '</div>'+

    '<div id="'+id+'Price" class="price">'+
    'Loading...'+
    '</div>'+

    '<div id="'+id+'Change">'+
    '</div>'+

    '</div>'
    );
}


function updateCrypto(id,data){

    const price=
        document.getElementById(
            id+"Price"
        );

    const change=
        document.getElementById(
            id+"Change"
        );

    if(!price||!change||!data){
        return;
    }

    price.textContent=
        money(data.price);

    change.innerHTML=
        changeHTML(data.change);
}


function stockCard(symbol,name){

    return (

    '<div class="stock-card">'+

    '<div class="stock-symbol">'+
    symbol+
    '</div>'+

    '<div class="muted" style="font-size:10px;margin-top:3px">'+
    name+
    '</div>'+

    '<div id="stock-'+symbol+'" class="stock-price">'+
    'Loading...'+
    '</div>'+

    '<div id="stock-change-'+symbol+'" class="stock-change">'+
    '—'+
    '</div>'+

    '</div>'
    );
}


function updateStock(symbol,data){

    const p=
        document.getElementById(
            "stock-"+symbol
        );

    const c=
        document.getElementById(
            "stock-change-"+symbol
        );

    if(!p||!c||!data){
        return;
    }

    if(Number(data.price)>0){

        p.textContent=
            "$"+
            Number(data.price)
            .toLocaleString(
                undefined,
                {
                    minimumFractionDigits:2,
                    maximumFractionDigits:2
                }
            );

        const n=
            Number(data.change||0);

        c.innerHTML=
            (n>=0?"+":"")+
            n.toFixed(2)+
            "% / 24h";

        c.style.color=
            n>=0
                ? "#19e6a1"
                : "#ff647c";

    }else{

        p.textContent=
            "Unavailable";

        c.textContent=
            "Market data unavailable";
    }
}


// ============================================================
// SERVICE
// ============================================================

function service(){

    shell(

    '<h1 class="page-title">Customer Service</h1>'+

    '<div class="card">'+

    '<h3>Need assistance?</h3>'+

    '<p class="muted">'+
    'Contact the Noon Market support channel through Telegram.'+
    '</p>'+

    '<br>'+

    '<a href="'+
    TG+
    '" target="_blank" rel="noopener">'+

    '<button class="btn">'+
    'Open Customer Service'+
    '</button>'+

    '</a>'+

    '</div>'

    );
}


// ============================================================
// PLANS
// ============================================================

function plans(){

    shell(

    '<h1 class="page-title">Our Plans</h1>'+

    '<div class="notice">'+
    'The rates shown below are illustrative program examples only. '+
    'They are not guaranteed returns or investment promises. '+
    'Actual eligibility and terms should be confirmed through official support.'+
    '</div>'+

    '<div class="plans">'+

    '<div class="plan">'+

    '<div class="plan-head">'+
    '<div class="plan-name">Starter Plan</div>'+
    '<div class="demo-tag">ILLUSTRATIVE</div>'+
    '</div>'+

    '<div class="plan-rate">7% <span>example rate</span></div>'+

    '<div class="plan-desc">'+
    'Example deposit level: $50'+
    '</div>'+

    '<button class="plan-button" onclick="service()">'+
    'View Information'+
    '</button>'+

    '</div>'+


    '<div class="plan featured">'+

    '<div class="plan-head">'+
    '<div class="plan-name">Standard Plan</div>'+
    '<div class="demo-tag">ILLUSTRATIVE</div>'+
    '</div>'+

    '<div class="plan-rate">11% <span>example rate</span></div>'+

    '<div class="plan-desc">'+
    'Example deposit level: $500'+
    '</div>'+

    '<button class="plan-button" onclick="service()">'+
    'View Information'+
    '</button>'+

    '</div>'+


    '<div class="plan">'+

    '<div class="plan-head">'+
    '<div class="plan-name">Premium Plan</div>'+
    '<div class="demo-tag">ILLUSTRATIVE</div>'+
    '</div>'+

    '<div class="plan-rate">15% <span>example rate</span></div>'+

    '<div class="plan-desc">'+
    'Example deposit level: $10,000'+
    '</div>'+

    '<button class="plan-button" onclick="service()">'+
    'View Information'+
    '</button>'+

    '</div>'+

    '</div>'+

    '<div style="height:14px"></div>'+

    '<div class="card">'+

    '<h3>Supported Payment Methods</h3>'+

    '<div class="info-list">'+

    '<div class="info-item">'+
    '<b>🏦 Bank Transfer</b>'+
    '<span class="muted">Availability depends on country and payment provider.</span>'+
    '</div>'+

    '<div class="info-item">'+
    '<b>₿ Cryptocurrency</b>'+
    '<span class="muted">USDT and other supported cryptocurrencies may be available.</span>'+
    '</div>'+

    '<div class="info-item">'+
    '<b>💵 USD Payments</b>'+
    '<span class="muted">Available payment channels depend on location.</span>'+
    '</div>'+

    '</div>'+

    '</div>'+

    '<div style="height:14px"></div>'+

    '<div class="card">'+

    '<h3>Withdrawal Information</h3>'+

    '<p class="muted">'+
    'Withdrawal availability, processing time, minimum limits and applicable fees may vary by payment method and country.'+
    '</p>'+

    '<button class="small-btn" onclick="service()">'+
    'Ask Support'+
    '</button>'+

    '</div>'

    );
}


// ============================================================
// RECORDS
// ============================================================

function records(){

    const list=
        Array.isArray(u?.records)
            ? u.records
            : [];

    let html=
        list.map(x=>{

            const type=
                x.type||
                "Transaction";

            const amount=
                Number(x.amount||0);

            const reason=
                x.reason||"";

            const time=
                x.time
                    ? new Date(
                        x.time
                    ).toLocaleString()
                    : "";

            const isCredit=
                String(type)
                    .toLowerCase()
                    .includes("credit");

            return (

            '<div class="record">'+

            '<div>'+

            '<div class="record-type">'+
            (isCredit?"＋ ":"− ")+
            type+
            '</div>'+

            '<div class="record-info">'+
            reason+
            '</div>'+

            '<div class="record-info">'+
            time+
            '</div>'+

            '</div>'+

            '<div class="record-amount" style="color:'+
            (isCredit?"#19e6a1":"#ff647c")+
            '">'+

            (isCredit?"+":"-")+
            money(amount)+

            '</div>'+

            '</div>'
            );

        }).join("");

    if(!html){

        html=
            '<p class="muted">'+
            'No transactions yet.'+
            '</p>';
    }

    shell(

        '<h1 class="page-title">Records</h1>'+

        '<div class="records">'+
        html+
        '</div>'
    );
}


// ============================================================
// ACCOUNT
// ============================================================

async function account(){

    await refreshUser();

    if(!u){
        return login();
    }

    shell(

    '<h1 class="page-title">My Account</h1>'+

    '<div class="card">'+

    '<div class="account-row">'+
    '<span class="muted">Email</span>'+
    '<b>'+(u.email||"—")+'</b>'+
    '</div>'+

    '<div class="account-row">'+
    '<span class="muted">Phone</span>'+
    '<b>'+(u.phone||"—")+'</b>'+
    '</div>'+

    '<div class="account-row">'+
    '<span class="muted">Available Balance</span>'+
    '<b>'+money(u.balance)+'</b>'+
    '</div>'+

    '<div class="account-row">'+
    '<span class="muted">Account Status</span>'+
    '<b style="color:#19e6a1">'+
    (u.status||"active").toUpperCase()+
    '</b>'+
    '</div>'+

    '<br>'+

    '<button class="btn" onclick="logout()">'+
    'Sign Out'+
    '</button>'+

    '</div>'

    );
}


// ============================================================
// LOGOUT
// ============================================================

function logout(){

    localStorage.removeItem(
        "nm_user"
    );

    u=null;

    login();
}


// ============================================================
// AUTO BALANCE REFRESH
// ============================================================

setInterval(
    async()=>{

        if(!u||!u.id){
            return;
        }

        const oldBalance=
            Number(u.balance||0);

        const changed=
            await refreshUser();

        if(
            changed &&
            Number(u.balance||0)!==
            oldBalance
        ){

            const current=
                document.querySelector(
                    ".balance"
                );

            if(current){

                const amount=
                    current.querySelector(
                        ".balance"
                    );

            }

            const heroBalance=
                document.querySelector(
                    ".hero .balance"
                );

            if(heroBalance){

                heroBalance.textContent=
                    money(u.balance);
            }
        }

    },
    5000
);


// ============================================================
// START
// ============================================================

if(u&&u.id){

    home();

}else{

    login();
}

</script>

</body>
</html>`;
}


// ============================================================
// SERVER
// ============================================================

const server=
    http.createServer(
        async(req,res)=>{

            const url=
                new URL(
                    req.url,
                    "http://127.0.0.1:"+PORT
                );

            const p=url.pathname;


            if(req.method==="OPTIONS"){

                res.writeHead(
                    204,
                    {
                        "Access-Control-Allow-Origin":"*",
                        "Access-Control-Allow-Headers":
                            "Content-Type",
                        "Access-Control-Allow-Methods":
                            "GET,POST,OPTIONS"
                    }
                );

                return res.end();
            }


            // ====================================================
            // LOGIN
            // ====================================================

            if(
                req.method==="POST" &&
                p==="/api/login"
            ){

                try{

                    const data=
                        await body(req);

                    const email=
                        String(
                            data.email||""
                        )
                        .trim()
                        .toLowerCase();

                    const phone=
                        String(
                            data.phone||""
                        )
                        .trim();

                    const password=
                        String(
                            data.password||""
                        );

                    if(!email&&!phone){

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Enter an email or phone number."
                            }
                        );
                    }

                    if(!password){

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Enter your password."
                            }
                        );
                    }

                    const users=
                        readUsers();

                    const user=
                        users.find(x=>{

                            const emailMatch=
                                email &&
                                String(
                                    x.email||""
                                )
                                .toLowerCase()===
                                email;

                            const phoneMatch=
                                phone &&
                                String(
                                    x.phone||""
                                )
                                .trim()===
                                phone;

                            return(
                                emailMatch||
                                phoneMatch
                            );
                        });

                    if(!user){

                        return sendJSON(
                            res,
                            401,
                            {
                                error:
                                    "Account not found."
                            }
                        );
                    }

                    if(
                        String(
                            user.password||""
                        )!==password
                    ){

                        return sendJSON(
                            res,
                            401,
                            {
                                error:
                                    "Incorrect password."
                            }
                        );
                    }

                    if(
                        user.status &&
                        user.status!=="active"
                    ){

                        return sendJSON(
                            res,
                            403,
                            {
                                error:
                                    "This account is suspended."
                            }
                        );
                    }

                    return sendJSON(
                        res,
                        200,
                        {
                            success:true,

                            user:{
                                id:user.id,

                                email:
                                    user.email||"",

                                phone:
                                    user.phone||"",

                                balance:
                                    Number(
                                        user.balance||0
                                    ),

                                status:
                                    user.status||
                                    "active",

                                transactions:
                                    user.transactions||
                                    user.records||
                                    []
                            }
                        }
                    );

                }catch(error){

                    return sendJSON(
                        res,
                        400,
                        {
                            error:error.message
                        }
                    );
                }
            }


            // ====================================================
            // CREATE ACCOUNT
            // ====================================================

            if(
                req.method==="POST" &&
                p==="/api/users"
            ){

                try{

                    const data=
                        await body(req);

                    const email=
                        String(
                            data.email||""
                        )
                        .trim()
                        .toLowerCase();

                    const phone=
                        String(
                            data.phone||""
                        )
                        .trim();

                    const password=
                        String(
                            data.password||""
                        );

                    if(!email&&!phone){

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Email or phone is required"
                            }
                        );
                    }

                    if(!password){

                        return sendJSON(
                            res,
                            400,
                            {
                                error:
                                    "Password is required"
                            }
                        );
                    }

                    const users=
                        readUsers();

                    const exists=
                        users.find(user=>

                            (
                                email &&
                                String(
                                    user.email||""
                                )
                                .toLowerCase()===
                                email
                            )||

                            (
                                phone &&
                                String(
                                    user.phone||""
                                )
                                .trim()===
                                phone
                            )
                        );

                    if(exists){

                        return sendJSON(
                            res,
                            409,
                            {
                                error:
                                    "Account already exists. Please use Login."
                            }
                        );
                    }

                    const user={

                        id:
                            "user_"+
                            Date.now()+
                            "_"+
                            Math.random()
                                .toString(36)
                                .slice(2,8),

                        email,

                        phone,

                        password,

                        balance:0,

                        status:"active",

                        transactions:[],

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
                            success:true,

                            user:{
                                id:user.id,
                                email:user.email,
                                phone:user.phone,
                                balance:user.balance,
                                status:user.status,
                                transactions:user.transactions,
                                createdAt:user.createdAt
                            }
                        }
                    );

                }catch(error){

                    return sendJSON(
                        res,
                        400,
                        {
                            error:error.message
                        }
                    );
                }
            }


            // ====================================================
            // GET USER
            // ====================================================

            const userMatch=
                p.match(
                    /^\/api\/users\/([^/]+)$/
                );

            if(
                req.method==="GET" &&
                userMatch
            ){

                const id=
                    decodeURIComponent(
                        userMatch[1]
                    );

                const users=
                    readUsers();

                const user=
                    users.find(
                        x=>x.id===id
                    );

                if(!user){

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
                        success:true,

                        user:{
                            id:user.id,

                            email:
                                user.email||"",

                            phone:
                                user.phone||"",

                            balance:
                                Number(
                                    user.balance||0
                                ),

                            status:
                                user.status||
                                "active",

                            transactions:
                                user.transactions||
                                user.records||
                                []
                        }
                    }
                );
            }


            // ====================================================
            // HOME
            // ====================================================

            if(
                req.method==="GET" &&
                p==="/"
            ){

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
                    page()
                );
            }


            // ====================================================
            // MARKET
            // ====================================================

            if(
                req.method==="GET" &&
                p==="/api/market"
            ){

                try{

                    const d=
                        await market();

                    return sendJSON(
                        res,
                        200,
                        d
                    );

                }catch(error){

                    console.error(
                        "Market:",
                        error
                    );

                    return sendJSON(
                        res,
                        502,
                        {
                            error:
                                "Market data unavailable"
                        }
                    );
                }
            }


            return sendJSON(
                res,
                404,
                {
                    error:"Not found"
                }
            );
        }
    );


// ============================================================
// SERVER ERROR
// ============================================================

server.on(
    "error",
    error=>{

        if(
            error.code==="EADDRINUSE"
        ){

            console.error(
                "Port "+
                PORT+
                " is already in use."
            );

            return;
        }

        console.error(error);
    }
);


// ============================================================
// START
// ============================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            "Noon Market server running on port " +
            PORT
        );
    }
);