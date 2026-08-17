const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

const ADMIN_USER =
    process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "ChangeMe123!";

const DATA_DIR =
    path.join(__dirname, "data");

const USERS_FILE =
    path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(
        USERS_FILE,
        "[]",
        "utf8"
    );
}


/* ============================================================
   USERS
============================================================ */

function readUsers() {

    try {

        const data =
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            );

        const users =
            JSON.parse(data);

        return Array.isArray(users)
            ? users
            : [];

    } catch (error) {

        console.error(
            "readUsers:",
            error.message
        );

        return [];
    }
}


function writeUsers(users) {

    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(
            users,
            null,
            2
        ),
        "utf8"
    );
}


/* ============================================================
   BODY
============================================================ */

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
                        return resolve({});
                    }

                    try {

                        resolve(
                            JSON.parse(data)
                        );

                    } catch (error) {

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


/* ============================================================
   JSON RESPONSE
============================================================ */

function sendJSON(
    res,
    status,
    data
) {

    res.writeHead(
        status,
        {
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
        }
    );

    res.end(
        JSON.stringify(data)
    );
}


/* ============================================================
   ADMIN SESSIONS
============================================================ */

const adminSessions =
    new Map();


function adminAuth(req) {

    const header =
        req.headers.authorization || "";

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {
        return false;
    }

    const token =
        header.substring(7);

    return adminSessions.has(
        token
    );
}


/* ============================================================
   MARKET DATA
============================================================ */

function getJSON(url) {

    return new Promise(
        (resolve, reject) => {

            https.get(
                url,
                {
                    headers: {
                        "User-Agent":
                            "Noon-Market"
                    }
                },
                response => {

                    let data = "";

                    response.on(
                        "data",
                        chunk => {
                            data += chunk;
                        }
                    );

                    response.on(
                        "end",
                        () => {

                            try {

                                resolve(
                                    JSON.parse(
                                        data
                                    )
                                );

                            } catch (error) {

                                reject(
                                    error
                                );

                            }

                        }
                    );

                }
            ).on(
                "error",
                reject
            );

        }
    );
}


async function market() {

    const data =
        await getJSON(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin&vs_currencies=usd&include_24hr_change=true"
        );


    return {

        btc: {
            price:
                Number(
                    data.bitcoin?.usd || 0
                ),

            change:
                Number(
                    data.bitcoin?.usd_24h_change || 0
                )
        },

        eth: {
            price:
                Number(
                    data.ethereum?.usd || 0
                ),

            change:
                Number(
                    data.ethereum?.usd_24h_change || 0
                )
        },

        usdt: {
            price:
                Number(
                    data.tether?.usd || 0
                ),

            change:
                Number(
                    data.tether?.usd_24h_change || 0
                )
        },

        bnb: {
            price:
                Number(
                    data.binancecoin?.usd || 0
                ),

            change:
                Number(
                    data.binancecoin?.usd_24h_change || 0
                )
        }

    };
}


/* ============================================================
   WEBSITE PAGE
============================================================ */

function page() {

    return `
<!doctype html>

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
    font-family:Arial,Helvetica,sans-serif;
    background:#050505;
    color:#fff;
}

#root{
    min-height:100vh;
}

</style>

</head>

<body>

<div id="root"></div>

<script>

const API = "";

let u =
    JSON.parse(
        localStorage.getItem(
            "nm_user"
        ) || "null"
    );


function money(n){

    return "$" +
        Number(
            n || 0
        ).toLocaleString(
            "en-US",
            {
                minimumFractionDigits:2,
                maximumFractionDigits:2
            }
        );

}


async function refreshUser(){

    if(!u || !u.id){
        return;
    }

    try{

        const response =
            await fetch(
                API +
                "/api/users/" +
                encodeURIComponent(
                    u.id
                )
            );

        const data =
            await response.json();

        if(
            response.ok &&
            data.user
        ){

            u = {

                id:
                    data.user.id,

                email:
                    data.user.email || "",

                phone:
                    data.user.phone || "",

                balance:
                    Number(
                        data.user.balance || 0
                    ),

                status:
                    data.user.status ||
                    "active",

                records:
                    data.user.transactions ||
                    []

            };


            localStorage.setItem(
                "nm_user",
                JSON.stringify(u)
            );

        }

    }catch(error){

        console.error(
            error
        );

    }

}


function login(){

    document.getElementById(
        "root"
    ).innerHTML = `

    <div style="
        max-width:420px;
        margin:80px auto;
        padding:30px;
    ">

        <h1>
            NOON MARKET
        </h1>

        <p>
            Secure account access
        </p>

        <input
            id="loginEmail"
            placeholder="Email or phone"
            style="
                width:100%;
                padding:14px;
                margin:8px 0;
            "
        >

        <input
            id="loginPassword"
            type="password"
            placeholder="Password"
            style="
                width:100%;
                padding:14px;
                margin:8px 0;
            "
        >

        <button
            onclick="doLogin()"
            style="
                width:100%;
                padding:14px;
                margin-top:10px;
                cursor:pointer;
            "
        >
            Sign In
        </button>

        <button
            onclick="signup()"
            style="
                width:100%;
                padding:14px;
                margin-top:10px;
                cursor:pointer;
            "
        >
            Create Account
        </button>

        <div
            id="loginError"
            style="
                color:#ff5555;
                margin-top:15px;
            "
        ></div>

    </div>

    `;

}


async function doLogin(){

    const value =
        document.getElementById(
            "loginEmail"
        ).value.trim();

    const password =
        document.getElementById(
            "loginPassword"
        ).value;


    try{

        const response =
            await fetch(
                API +
                "/api/login",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            email:value,

                            password:password

                        })
                }
            );


        const data =
            await response.json();


        if(
            !response.ok
        ){

            document.getElementById(
                "loginError"
            ).textContent =
                data.error ||
                "Login failed";

            return;
        }


        u = {

            id:
                data.user.id,

            email:
                data.user.email || "",

            phone:
                data.user.phone || "",

            balance:
                Number(
                    data.user.balance || 0
                ),

            status:
                data.user.status ||
                "active",

            records:
                data.user.transactions ||
                []

        };


        localStorage.setItem(
            "nm_user",
            JSON.stringify(u)
        );


        home();

    }catch(error){

        document.getElementById(
            "loginError"
        ).textContent =
            "Backend connection failed.";

    }

}


function signup(){

    document.getElementById(
        "root"
    ).innerHTML = `

    <div style="
        max-width:420px;
        margin:80px auto;
        padding:30px;
    ">

        <h1>
            NOON MARKET
        </h1>

        <h2>
            Create Account
        </h2>

        <input
            id="signupEmail"
            placeholder="Email"
            style="
                width:100%;
                padding:14px;
                margin:8px 0;
            "
        >

        <input
            id="signupPhone"
            placeholder="Phone"
            style="
                width:100%;
                padding:14px;
                margin:8px 0;
            "
        >

        <input
            id="signupPassword"
            type="password"
            placeholder="Password"
            style="
                width:100%;
                padding:14px;
                margin:8px 0;
            "
        >

        <button
            onclick="doSignup()"
            style="
                width:100%;
                padding:14px;
                margin-top:10px;
            "
        >
            Create Account
        </button>

        <button
            onclick="login()"
            style="
                width:100%;
                padding:14px;
                margin-top:10px;
            "
        >
            Back to Login
        </button>

        <div
            id="signupError"
            style="
                color:#ff5555;
                margin-top:15px;
            "
        ></div>

    </div>

    `;

}


async function doSignup(){

    const email =
        document.getElementById(
            "signupEmail"
        ).value.trim();

    const phone =
        document.getElementById(
            "signupPhone"
        ).value.trim();

    const password =
        document.getElementById(
            "signupPassword"
        ).value;


    try{

        const response =
            await fetch(
                API +
                "/api/users",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            email,
                            phone,
                            password

                        })
                }
            );


        const data =
            await response.json();


        if(
            !response.ok
        ){

            document.getElementById(
                "signupError"
            ).textContent =
                data.error ||
                "Account creation failed";

            return;
        }


        alert(
            "Account created successfully. Balance: $0.00"
        );


        login();

    }catch(error){

        document.getElementById(
            "signupError"
        ).textContent =
            "Backend connection failed.";

    }

}


async function home(){

    await refreshUser();

    if(!u){

        login();

        return;
    }


    document.getElementById(
        "root"
    ).innerHTML = `

    <div style="
        max-width:900px;
        margin:auto;
        padding:25px;
    ">

        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
        ">

            <h1>
                NOON MARKET
            </h1>

            <button
                onclick="logout()"
            >
                Sign Out
            </button>

        </div>


        <div style="
            background:#111;
            border-radius:18px;
            padding:30px;
            margin-top:25px;
        ">

            <div>
                Available Balance
            </div>

            <div style="
                font-size:42px;
                font-weight:bold;
                margin-top:10px;
            ">

                ${
                    money(
                        u.balance
                    )
                }

            </div>

            <div style="
                margin-top:10px;
                color:#aaa;
            ">

                ${
                    u.email ||
                    u.phone
                }

            </div>

        </div>


        <div style="
            margin-top:30px;
        ">

            <h2>
                Crypto Market
            </h2>

            <div
                id="market"
            >
                Loading market...
            </div>

        </div>


        <div style="
            margin-top:30px;
        ">

            <h3>
                Account Status
            </h3>

            <p>
                ${
                    u.status
                }
            </p>

        </div>

    </div>

    `;


    loadMarket();

}


async function loadMarket(){

    try{

        const response =
            await fetch(
                API +
                "/api/market"
            );

        const data =
            await response.json();


        document.getElementById(
            "market"
        ).innerHTML = `

        <div style="
            display:grid;
            grid-template-columns:
                repeat(auto-fit,minmax(180px,1fr));
            gap:15px;
        ">

            ${coin(
                "Bitcoin",
                data.btc
            )}

            ${coin(
                "Ethereum",
                data.eth
            )}

            ${coin(
                "Tether",
                data.usdt
            )}

            ${coin(
                "BNB",
                data.bnb
            )}

        </div>

        `;

    }catch(error){

        document.getElementById(
            "market"
        ).textContent =
            "Market data unavailable";

    }

}


function coin(
    name,
    data
){

    return `

    <div style="
        background:#111;
        padding:20px;
        border-radius:15px;
    ">

        <b>
            ${name}
        </b>

        <div style="
            font-size:22px;
            margin-top:10px;
        ">

            ${money(data.price)}

        </div>

        <div style="
            margin-top:8px;
        ">

            ${
                Number(
                    data.change || 0
                ).toFixed(2)
            }%

        </div>

    </div>

    `;

}


function logout(){

    localStorage.removeItem(
        "nm_user"
    );

    u = null;

    login();

}


if(
    u &&
    u.id
){

    home();

}else{

    login();

}

</script>

</body>

</html>
`;

}


/* ============================================================
   SERVER
============================================================ */

const server =
    http.createServer(
        async (
            req,
            res
        ) => {

            const url =
                new URL(
                    req.url,
                    "http://127.0.0.1:" +
                    PORT
                );

            const p =
                url.pathname;


            /* ==================================================
               CORS
            ================================================== */

            if(
                req.method ===
                "OPTIONS"
            ){

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


            /* ==================================================
               ADMIN LOGIN
            ================================================== */

            if(
                req.method === "POST" &&
                p === "/api/admin/login"
            ){

                try{

                    const data =
                        await body(req);


                    if(
                        data.username !==
                            ADMIN_USER ||
                        data.password !==
                            ADMIN_PASSWORD
                    ){

                        return sendJSON(
                            res,
                            401,
                            {
                                error:
                                    "Invalid admin username or password"
                            }
                        );

                    }


                    const token =
                        crypto
                            .randomBytes(32)
                            .toString("hex");


                    adminSessions.set(
                        token,
                        {
                            created:
                                Date.now()
                        }
                    );


                    return sendJSON(
                        res,
                        200,
                        {
                            success:true,
                            token
                        }
                    );

                }catch(error){

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


            /* ==================================================
               ADMIN USERS
            ================================================== */

            if(
                req.method === "GET" &&
                p === "/api/admin/users"
            ){

                if(
                    !adminAuth(req)
                ){

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
                    readUsers();


                return sendJSON(
                    res,
                    200,
                    {
                        success:true,

                        users:
                            users.map(
                                user => ({
                                    id:
                                        user.id,

                                    email:
                                        user.email ||
                                        "",

                                    phone:
                                        user.phone ||
                                        "",

                                    balance:
                                        Number(
                                            user.balance ||
                                            0
                                        ),

                                    status:
                                        user.status ||
                                        "active",

                                    transactions:
                                        Array.isArray(
                                            user.transactions
                                        )
                                            ? user.transactions
                                            : [],

                                    createdAt:
                                        user.createdAt ||
                                        ""
                                })
                            )
                    }
                );

            }


            /* ==================================================
               ADMIN GET USER
            ================================================== */

            const adminUserMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)$/
                );


            if(
                req.method === "GET" &&
                adminUserMatch
            ){

                if(
                    !adminAuth(req)
                ){

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

                        user
                    }
                );

            }


            /* ==================================================
               ADMIN CHANGE BALANCE
            ================================================== */

            const balanceMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/balance$/
                );


            if(
                req.method === "POST" &&
                balanceMatch
            ){

                if(
                    !adminAuth(req)
                ){

                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Unauthorized"
                        }
                    );

                }


                try{

                    const id =
                        decodeURIComponent(
                            balanceMatch[1]
                        );


                    const data =
                        await body(req);


                    const amount =
                        Number(
                            data.amount
                        );


                    if(
                        !Number.isFinite(
                            amount
                        ) ||
                        amount <= 0
                    ){

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
                        data.type === "debit"
                            ? "debit"
                            : "credit";


                    const users =
                        readUsers();


                    const user =
                        users.find(
                            x =>
                                x.id === id
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


                    user.balance =
                        Number(
                            user.balance || 0
                        );


                    if(
                        type === "credit"
                    ){

                        user.balance +=
                            amount;

                    }else{

                        user.balance -=
                            amount;


                        if(
                            user.balance < 0
                        ){

                            user.balance = 0;

                        }

                    }


                    if(
                        !Array.isArray(
                            user.transactions
                        )
                    ){

                        user.transactions = [];

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


                    writeUsers(
                        users
                    );


                    return sendJSON(
                        res,
                        200,
                        {
                            success:true,
                            user
                        }
                    );

                }catch(error){

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


            /* ==================================================
               ADMIN CHANGE STATUS
            ================================================== */

            const statusMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/status$/
                );


            if(
                req.method === "PATCH" &&
                statusMatch
            ){

                if(
                    !adminAuth(req)
                ){

                    return sendJSON(
                        res,
                        401,
                        {
                            error:
                                "Unauthorized"
                        }
                    );

                }


                try{

                    const id =
                        decodeURIComponent(
                            statusMatch[1]
                        );


                    const data =
                        await body(req);


                    if(
                        data.status !==
                            "active" &&
                        data.status !==
                            "suspended"
                    ){

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


                    user.status =
                        data.status;


                    writeUsers(
                        users
                    );


                    return sendJSON(
                        res,
                        200,
                        {
                            success:true,
                            user
                        }
                    );

                }catch(error){

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


            /* ==================================================
               CUSTOMER LOGIN
            ================================================== */

            if(
                req.method === "POST" &&
                p === "/api/login"
            ){

                try{

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
                        )
                            .trim();


                    const password =
                        String(
                            data.password || ""
                        );


                    if(
                        !email &&
                        !phone
                    ){

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


                    const users =
                        readUsers();


                    const user =
                        users.find(
                            x => {

                                const emailMatch =
                                    email &&
                                    String(
                                        x.email || ""
                                    )
                                        .toLowerCase() ===
                                    email;


                                const phoneMatch =
                                    phone &&
                                    String(
                                        x.phone || ""
                                    )
                                        .trim() ===
                                    phone;


                                return (
                                    emailMatch ||
                                    phoneMatch
                                );

                            }
                        );


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
                            user.password ||
                            ""
                        ) !== password
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
                        user.status !==
                            "active"
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

                                id:
                                    user.id,

                                email:
                                    user.email ||
                                    "",

                                phone:
                                    user.phone ||
                                    "",

                                balance:
                                    Number(
                                        user.balance ||
                                        0
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

                }catch(error){

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


            /* ==================================================
               CREATE ACCOUNT
            ================================================== */

            if(
                req.method === "POST" &&
                p === "/api/users"
            ){

                try{

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
                        )
                            .trim();


                    const password =
                        String(
                            data.password || ""
                        );


                    if(
                        !email &&
                        !phone
                    ){

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


                    const users =
                        readUsers();


                    const exists =
                        users.find(
                            user =>

                                (
                                    email &&
                                    String(
                                        user.email ||
                                        ""
                                    )
                                        .toLowerCase() ===
                                    email
                                ) ||

                                (
                                    phone &&
                                    String(
                                        user.phone ||
                                        ""
                                    )
                                        .trim() ===
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


                    const user = {

                        id:
                            "user_" +
                            Date.now() +
                            "_" +
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


                    users.push(
                        user
                    );


                    writeUsers(
                        users
                    );


                    return sendJSON(
                        res,
                        201,
                        {

                            success:true,

                            user:{

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

                }catch(error){

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


            /* ==================================================
               GET CUSTOMER USER
            ================================================== */

            const userMatch =
                p.match(
                    /^\/api\/users\/([^/]+)$/
                );


            if(
                req.method === "GET" &&
                userMatch
            ){

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

                            id:
                                user.id,

                            email:
                                user.email ||
                                "",

                            phone:
                                user.phone ||
                                "",

                            balance:
                                Number(
                                    user.balance ||
                                    0
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


            /* ==================================================
               MARKET
            ================================================== */

            if(
                req.method === "GET" &&
                p === "/api/market"
            ){

                try{

                    const data =
                        await market();


                    return sendJSON(
                        res,
                        200,
                        data
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


            /* ==================================================
               HOME
            ================================================== */

            if(
                req.method === "GET" &&
                p === "/"
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


            /* ==================================================
               404
            ================================================== */

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


/* ============================================================
   SERVER ERROR
============================================================ */

server.on(
    "error",
    error => {

        if(
            error.code ===
            "EADDRINUSE"
        ){

            console.error(
                "Port " +
                PORT +
                " is already in use."
            );

            return;
        }


        console.error(
            error
        );

    }
);


/* ============================================================
   START
============================================================ */

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
