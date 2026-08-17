const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;

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
const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const TG = "https://t.me/customer_service_34";

async function market() {
    const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd&include_24hr_change=true"
    );

    if (!r.ok) throw Error("market");

    const d = await r.json();

    return {
        btc: {
            price: d.bitcoin.usd,
            change: d.bitcoin.usd_24h_change || 0
        },
        usdt: {
            price: d.tether.usd,
            change: d.tether.usd_24h_change || 0
        },
        updatedAt: new Date().toISOString()
    };
}

function page() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Noon Market</title>

<style>
*{box-sizing:border-box}
body{margin:0;background:#f5f6f8;color:#101828;font:15px Arial}
.app{min-height:100vh;padding-bottom:80px}
header{height:70px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid #eee;position:sticky;top:0;z-index:5}
.logo{font-size:24px;font-weight:800}
.container{max-width:760px;margin:auto;padding:18px}
.login{min-height:100vh;display:grid;place-items:center;padding:20px}
.box,.card,.coin,.recordbox{background:#fff;border-radius:20px;padding:20px;box-shadow:0 5px 20px #00000009}
.box{width:min(420px,100%)}
input{width:100%;padding:14px;border:1px solid #d0d5dd;border-radius:12px;margin:7px 0 12px}
.btn{width:100%;padding:14px;border:0;border-radius:13px;background:#111827;color:white;font-weight:700}
.balance{background:#111827;color:white;border-radius:23px;padding:23px;margin-bottom:14px}
.balance strong{display:block;font-size:34px;margin:7px 0}
.market{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.price{font-size:22px;font-weight:800;margin-top:8px}
.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
.action{border:0;background:white;border-radius:17px;padding:17px 5px;font-weight:700}
.plan{display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:17px;padding:16px;margin:10px 0}
.plan button{background:#111827;color:#fff;border:0;border-radius:10px;padding:9px 13px}
.bottom{position:fixed;bottom:0;left:0;right:0;height:68px;background:#fff;border-top:1px solid #eee;display:flex;justify-content:space-around;align-items:center}
.nav{border:0;background:none;color:#667085}
.active{color:#111827;font-weight:800}
.muted{color:#667085}
.record{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee}

@media(max-width:560px){
    .market{grid-template-columns:1fr}
    .actions{grid-template-columns:1fr 1fr 1fr}
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

const money=n=>"$"+Number(n||0).toFixed(2);

function login(){

    root.innerHTML=
    '<main class=login>' +
    '<section class=box>' +
    '<h1>Noon Market</h1>' +
    '<p class=muted>Secure account access</p>' +
    '<input id=email type=email placeholder="Email address">' +
    '<input id=phone placeholder="Phone number (optional)">' +
    '<input id=pass type=password placeholder="Password">' +
    '<button class=btn onclick=signin()>Sign In</button>' +
    '<p class=muted>Production authentication should be connected to a secure backend.</p>' +
    '</section>' +
    '</main>';

}

async function signin(){

    let e=email.value.trim();
    let p=phone.value.trim();
    let password=pass.value;

    if(!e&&!p){
        return alert("Enter an email or phone number.");
    }

    if(!password){
        return alert("Enter your password.");
    }

    try{

        let response=await fetch(
            "http://127.0.0.1:3001/api/users",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    email:e,
                    phone:p,
                    password:password
                })
            }
        );

        let data=await response.json();

        if(!response.ok){
            return alert(data.error || "Registration failed.");
        }

        u={
            id:data.user.id,
            email:data.user.email,
            phone:data.user.phone,
            balance:Number(data.user.balance||0),
            records:data.user.transactions||[]
        };

        localStorage.setItem(
            "nm_user",
            JSON.stringify(u)
        );

        home();

    }catch(error){

        alert(
            "Backend connection failed. Make sure admin-server.js is running on port 3001."
        );

    }
}

function shell(c){

    root.innerHTML=
    '<div class=app>' +

    '<header>' +
    '<b class=logo>Noon Market</b>' +
    '<button onclick=logout()>Sign Out</button>' +
    '</header>' +

    '<main class=container>' +
    c +
    '</main>' +

    '<nav class=bottom>' +
    '<button class=nav onclick=home()>Home</button>' +
    '<button class=nav onclick=service()>Service</button>' +
    '<button class=nav onclick=plans()>Our Plans</button>' +
    '<button class=nav onclick=records()>Records</button>' +
    '<button class=nav onclick=account()>Account</button>' +
    '</nav>' +

    '</div>';

}

async function home(){

    shell(
        '<div class=balance>' +
        '<small>Available Balance</small>' +
        '<strong>'+money(u.balance)+'</strong>' +
        '<small>'+(u.email||u.phone)+'</small>' +
        '</div>' +

        '<section class=market>' +

        '<div class=coin>' +
        '<b>BTC / USD</b>' +
        '<div id=btc class=price>Loading...</div>' +
        '<small id=bc>—</small>' +
        '</div>' +

        '<div class=coin>' +
        '<b>USDT / USD</b>' +
        '<div id=usdt class=price>Loading...</div>' +
        '<small id=uc>—</small>' +
        '</div>' +

        '</section>' +

        '<section class=actions>' +
        '<button class=action onclick=service()>Deposit</button>' +
        '<button class=action onclick=service()>Withdrawal</button>' +
        '<button class=action onclick=plans()>Our Plans</button>' +
        '</section>' +

        '<div class=card>' +
        '<h3>Customer Service</h3>' +
        '<p class=muted>Contact our official support channel.</p>' +
        '<button class=btn onclick=service()>Customer Service</button>' +
        '</div>'
    );

    try{

        let d=await fetch("/api/market")
            .then(x=>x.json());

        btc.textContent=money(d.btc.price);
        usdt.textContent=money(d.usdt.price);

        bc.textContent=
            d.btc.change.toFixed(2)+"% / 24h";

        uc.textContent=
            d.usdt.change.toFixed(2)+"% / 24h";

    }catch(e){

        btc.textContent="Unavailable";
        usdt.textContent="Unavailable";

    }
}

function service(){

    shell(
        '<h2>Customer Service</h2>' +
        '<div class=card>' +
        '<h3>Need assistance?</h3>' +
        '<p class=muted>Contact our customer service team through Telegram.</p>' +
        '<a href="'+TG+'" target=_blank rel=noopener>' +
        '<button class=btn>Click Here</button>' +
        '</a>' +
        '</div>'
    );

}

function plans(){

    shell(
        '<h2>Our Plans</h2>' +

        '<div class=plan>' +
        '<div><b>Starter Plan</b><div class=muted>View terms and conditions</div></div>' +
        '<button>View</button>' +
        '</div>' +

        '<div class=plan>' +
        '<div><b>Standard Plan</b><div class=muted>View terms and conditions</div></div>' +
        '<button>View</button>' +
        '</div>' +

        '<div class=plan>' +
        '<div><b>Premium Plan</b><div class=muted>View terms and conditions</div></div>' +
        '<button>View</button>' +
        '</div>'
    );

}

function records(){

    let r=(u.records||[])
        .map(x=>
            '<div class=record>' +
            '<span><b>'+x.type+'</b><br>' +
            '<small>'+new Date(x.time).toLocaleString()+'</small></span>' +
            '<b>'+money(x.amount)+'</b>' +
            '</div>'
        )
        .join('') ||

        '<p class=muted>No transactions yet.</p>';

    shell(
        '<h2>Records</h2>' +
        '<div class=recordbox>'+r+'</div>'
    );

}

function account(){

    shell(
        '<h2>My Account</h2>' +
        '<div class=card>' +
        '<p><b>Email:</b> '+(u.email||"—")+'</p>' +
        '<p><b>Phone:</b> '+(u.phone||"—")+'</p>' +
        '<p><b>Available Balance:</b> '+money(u.balance)+'</p>' +
        '<button class=btn onclick=logout()>Sign Out</button>' +
        '</div>'
    );

}

function logout(){

    localStorage.removeItem("nm_user");

    u=null;

    login();

}

u ? home() : login();

</script>

</body>
</html>`;
}


const server=http.createServer(async(req,res)=>{

    const p=new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if(p==="/"){
            // REGISTER USER
    if (
        req.method === "POST" &&
        p === "/api/users"
    ) {
        try {
            const data = await body(req);

            const email = String(data.email || "")
                .trim()
                .toLowerCase();

            const phone = String(data.phone || "")
                .trim();

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
                id: "user_" + Date.now() + "_" +
                    Math.random().toString(36).slice(2, 8),

                email: email,
                phone: phone,

                balance: 0,

                status: "active",

                transactions: [],

                createdAt: new Date().toISOString()
            };

            users.push(user);

            writeUsers(users);

            return sendJSON(res, 201, {
                success: true,
                user: user
            });

        } catch (error) {
            return sendJSON(res, 400, {
                error: error.message
            });
        }
    }

        res.writeHead(200,{
            "Content-Type":"text/html; charset=utf-8"
        });

        return res.end(page());
    }

    if(p==="/api/market"){

        try{

            const d=await market();

            res.writeHead(200,{
                "Content-Type":"application/json",
                "Cache-Control":"no-store"
            });

            return res.end(JSON.stringify(d));

        }catch(e){

            res.writeHead(502,{
                "Content-Type":"application/json"
            });

            return res.end(
                JSON.stringify({
                    error:"Market data unavailable"
                })
            );

        }
    }

    res.writeHead(404,{
        "Content-Type":"application/json"
    });

    res.end(
        JSON.stringify({
            error:"Not found"
        })
    );

});

server.listen(PORT,()=>{

    console.log(
        "Noon Market: http://127.0.0.1:"+PORT
    );

});