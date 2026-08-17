"use strict";

const http = require("http");

const PORT = 3001;

const LIVE_SERVER =
    "https://noon-market.onrender.com";


// ============================================================
// HELPERS
// ============================================================

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
            "GET, POST, PATCH, OPTIONS"
    });

    res.end(
        JSON.stringify(data)
    );
}


function sendHTML(res, html) {

    res.writeHead(200, {
        "Content-Type":
            "text/html; charset=utf-8",

        "Cache-Control":
            "no-store"
    });

    res.end(html);
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


// ============================================================
// REQUEST TO LIVE RENDER SERVER
// ============================================================

async function liveRequest(
    method,
    route,
    token = "",
    data = null
) {

    const options = {
        method,
        headers: {
            "Accept":
                "application/json"
        }
    };


    if (token) {

        options.headers.Authorization =
            "Bearer " + token;

    }


    if (data !== null) {

        options.headers[
            "Content-Type"
        ] =
            "application/json";

        options.body =
            JSON.stringify(data);

    }


    const response =
        await fetch(
            LIVE_SERVER + route,
            options
        );


    const text =
        await response.text();


    let result;

    try {

        result =
            JSON.parse(text);

    } catch {

        result = {
            error:
                text ||
                "Invalid server response"
        };

    }


    return {
        status:
            response.status,

        data:
            result
    };
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// ADMIN PAGE
// ============================================================

function adminPage() {

return `<!doctype html>

<html lang="en">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>Noon Market Admin</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #06080d;
    color: #fff;
    font-family:
        Arial,
        Helvetica,
        sans-serif;
}

header {

    height: 70px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding: 0 25px;

    background: #0d1119;

    border-bottom:
        1px solid #202735;
}

.logo {

    font-size: 20px;

    font-weight: 800;

    letter-spacing: 1px;
}

.logo span {
    color: #19e6a1;
}

.container {

    max-width: 1250px;

    margin: auto;

    padding: 25px;
}

.card {

    background: #0d1119;

    border:
        1px solid #202735;

    border-radius: 14px;

    padding: 20px;

    margin-bottom: 20px;
}

.login {

    max-width: 430px;

    margin:
        100px auto;
}

h1,
h2,
h3 {
    margin-top: 0;
}

input,
select,
textarea {

    width: 100%;

    padding: 13px;

    margin:
        8px 0;

    border:
        1px solid #30394a;

    border-radius: 9px;

    background: #070a10;

    color: white;

    outline: none;
}

input:focus,
textarea:focus {

    border-color:
        #19e6a1;
}

button {

    border: 0;

    border-radius: 9px;

    padding:
        11px 16px;

    font-weight: 700;

    cursor: pointer;
}

.primary {

    background:
        #19e6a1;

    color:
        #06100c;
}

.secondary {

    background:
        #202938;

    color: white;
}

.danger {

    background:
        #e5536e;

    color: white;
}

.logout {

    background:
        #202938;

    color: white;
}

.hidden {
    display: none !important;
}

.error {

    color:
        #ff6179;

    margin-top:
        10px;
}

.success {

    color:
        #19e6a1;

    margin-top:
        10px;
}

.toolbar {

    display: flex;

    gap: 10px;

    flex-wrap: wrap;

    align-items: center;
}

.search {

    flex:
        1;

    min-width:
        250px;
}

.user-grid {

    display: grid;

    grid-template-columns:
        repeat(
            auto-fill,
            minmax(290px, 1fr)
        );

    gap: 15px;
}

.user-card {

    background:
        #080c13;

    border:
        1px solid #242d3d;

    border-radius:
        13px;

    padding:
        17px;
}

.user-card:hover {

    border-color:
        #19e6a1;
}

.user-email {

    font-size:
        16px;

    font-weight:
        700;

    word-break:
        break-word;
}

.user-phone {

    color:
        #929bad;

    margin-top:
        5px;
}

.user-id {

    color:
        #687386;

    font-size:
        11px;

    margin-top:
        7px;

    word-break:
        break-all;
}

.balance {

    font-size:
        26px;

    font-weight:
        800;

    margin:
        18px 0;
}

.status {

    display:
        inline-block;

    padding:
        5px 9px;

    border-radius:
        20px;

    font-size:
        11px;

    background:
        #123125;

    color:
        #19e6a1;
}

.status.suspended {

    background:
        #35151d;

    color:
        #ff6179;
}

.actions {

    display:
        flex;

    gap:
        8px;

    margin-top:
        15px;

    flex-wrap:
        wrap;
}

.actions button {
    flex: 1;
}

.stats {

    display:
        grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(180px,1fr)
        );

    gap:
        12px;

    margin-bottom:
        20px;
}

.stat {

    background:
        #080c13;

    border:
        1px solid #202735;

    border-radius:
        12px;

    padding:
        16px;
}

.stat-title {

    color:
        #8c96a8;

    font-size:
        12px;
}

.stat-value {

    font-size:
        23px;

    font-weight:
        800;

    margin-top:
        7px;
}

table {

    width:
        100%;

    border-collapse:
        collapse;
}

th,
td {

    padding:
        10px;

    text-align:
        left;

    border-bottom:
        1px solid #202735;

    font-size:
        13px;
}

.small {

    color:
        #8c96a8;

    font-size:
        12px;
}

.modal {

    position:
        fixed;

    inset:
        0;

    background:
        rgba(
            0,
            0,
            0,
            .75
        );

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    padding:
        20px;

    z-index:
        1000;
}

.modal-box {

    width:
        100%;

    max-width:
        500px;

    background:
        #0d1119;

    border:
        1px solid #2a3343;

    border-radius:
        15px;

    padding:
        22px;
}

.modal-actions {

    display:
        flex;

    gap:
        10px;

    margin-top:
        15px;
}

.modal-actions button {
    flex: 1;
}

@media(max-width:600px) {

    header {
        padding:
            0 15px;
    }

    .container {
        padding:
            15px;
    }

    th,
    td {
        font-size:
            11px;
        padding:
            7px;
    }

}

</style>

</head>

<body>


<header>

<div class="logo">
NOON <span>MARKET</span> ADMIN
</div>

<button
class="logout"
onclick="logout()"
>
Logout
</button>

</header>


<div class="container">


<!-- ========================================================
     LOGIN
======================================================== -->

<div
id="loginScreen"
class="card login"
>

<h2>Admin Login</h2>

<div class="small">
Connect to Noon Market live server
</div>

<br>

<input
id="username"
type="text"
placeholder="Admin username"
autocomplete="username"
>

<input
id="password"
type="password"
placeholder="Admin password"
autocomplete="current-password"
>

<button
class="primary"
style="width:100%;margin-top:10px"
onclick="adminLogin()"
>
Sign In
</button>

<div
id="loginError"
class="error"
></div>

</div>


<!-- ========================================================
     APP
======================================================== -->

<div
id="app"
class="hidden"
>


<div class="stats">

<div class="stat">

<div class="stat-title">
TOTAL CUSTOMERS
</div>

<div
id="totalUsers"
class="stat-value"
>
0
</div>

</div>


<div class="stat">

<div class="stat-title">
TOTAL BALANCE
</div>

<div
id="totalBalance"
class="stat-value"
>
$0.00
</div>

</div>


<div class="stat">

<div class="stat-title">
ACTIVE ACCOUNTS
</div>

<div
id="activeUsers"
class="stat-value"
>
0
</div>

</div>

</div>


<!-- ========================================================
     SEARCH
======================================================== -->

<div class="card">

<div class="toolbar">

<input
id="search"
class="search"
placeholder="Search customer by email, phone or ID..."
oninput="searchUsers()"
>

<button
class="primary"
onclick="loadUsers()"
>
Refresh
</button>

</div>

<div
id="userCount"
class="small"
style="margin-top:10px"
>
</div>

</div>


<!-- ========================================================
     USERS
======================================================== -->

<div
id="users"
class="user-grid"
>
</div>


<!-- ========================================================
     MESSAGE
======================================================== -->

<div
id="message"
></div>


</div>

</div>


<!-- ========================================================
     USER MODAL
======================================================== -->

<div
id="modal"
class="modal hidden"
>

<div class="modal-box">

<h2>
Account
</h2>

<div
id="modalUser"
></div>

<div
id="modalMessage"
></div>

<hr
style="
border:0;
border-top:1px solid #202735;
margin:20px 0;
"
>

<h3>
Balance Adjustment
</h3>

<select id="balanceType">

<option value="credit">
Increase Balance
</option>

<option value="debit">
Decrease Balance
</option>

</select>

<input
id="amount"
type="number"
step="0.01"
min="0"
placeholder="Amount"
>

<input
id="reason"
type="text"
placeholder="Reason"
>

<div class="modal-actions">

<button
class="primary"
onclick="changeBalance()"
>
Apply
</button>

<button
class="secondary"
onclick="closeModal()"
>
Close
</button>

</div>


<hr
style="
border:0;
border-top:1px solid #202735;
margin:22px 0;
"
>

<h3>
Account Status
</h3>

<div class="modal-actions">

<button
class="primary"
onclick="changeStatus('active')"
>
Activate
</button>

<button
class="danger"
onclick="changeStatus('suspended')"
>
Suspend
</button>

</div>


<hr
style="
border:0;
border-top:1px solid #202735;
margin:22px 0;
"
>

<h3>
Transactions
</h3>

<div
id="transactions"
>
</div>

</div>

</div>


<script>

const LIVE_SERVER =
    "https://noon-market.onrender.com";


let token =
    sessionStorage.getItem(
        "nm_admin_token"
    ) || "";


let users = [];


let selectedUser = null;


// ============================================================
// HTML ESCAPE
// ============================================================

function esc(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// FORMAT MONEY
// ============================================================

function money(value) {

    return "$" +
        Number(
            value || 0
        ).toLocaleString(
            "en-US",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
}


// ============================================================
// API
// ============================================================

async function api(
    route,
    options = {}
) {

    const headers =
        Object.assign(
            {},
            options.headers || {}
        );


    if (token) {

        headers.Authorization =
            "Bearer " +
            token;

    }


    options.headers =
        headers;


    const response =
        await fetch(
            route,
            options
        );


    let data = {};

    try {

        data =
            await response.json();

    } catch {

        data = {
            error:
                "Invalid server response"
        };

    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Request failed"
        );

    }


    return data;
}


// ============================================================
// ADMIN LOGIN
// ============================================================

async function adminLogin() {

    const username =
        document
        .getElementById("username")
        .value
        .trim();

    const password =
        document
        .getElementById("password")
        .value;


    if (!username || !password) {

        document
        .getElementById("loginError")
        .textContent =
            "Enter username and password.";

        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin/login",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            username,
                            password
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Login failed"
            );

        }


        token =
            data.token;


        sessionStorage.setItem(
            "nm_admin_token",
            token
        );


        document
        .getElementById(
            "loginScreen"
        )
        .classList
        .add("hidden");


        document
        .getElementById("app")
        .classList
        .remove("hidden");


        await loadUsers();


    } catch (error) {

        document
        .getElementById(
            "loginError"
        )
        .textContent =
            error.message;

    }
}


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {

    try {

        const data =
            await api(
                "/api/admin/users"
            );


        users =
            Array.isArray(
                data.users
            )
                ? data.users
                : [];


        renderUsers();

        updateStats();


    } catch (error) {

        if (
            error.message
                .toLowerCase()
                .includes("unauthorized")
        ) {

            logout();

            return;

        }


        showMessage(
            error.message,
            true
        );

    }
}


// ============================================================
// SEARCH
// ============================================================

function searchUsers() {

    renderUsers();

}


// ============================================================
// RENDER
// ============================================================

function renderUsers() {

    const search =
        document
        .getElementById("search")
        .value
        .trim()
        .toLowerCase();


    const filtered =
        users.filter(
            user => {

                const text =
                    [
                        user.id,
                        user.email,
                        user.phone
                    ]
                    .join(" ")
                    .toLowerCase();


                return text.includes(
                    search
                );

            }
        );


    document
    .getElementById("userCount")
    .textContent =
        filtered.length +
        " customer(s)";


    const box =
        document
        .getElementById("users");


    if (!filtered.length) {

        box.innerHTML = `

<div class="card">

No customers found.

</div>

`;

        return;

    }


    box.innerHTML =
        filtered
        .map(
            user => {

                const status =
                    user.status ||
                    "active";


                return `

<div class="user-card">

<div class="user-email">

${esc(
    user.email ||
    "No email"
)}

</div>


<div class="user-phone">

${esc(
    user.phone ||
    "No phone"
)}

</div>


<div class="user-id">

${esc(
    user.id
)}

</div>


<div class="balance">

${money(
    user.balance
)}

</div>


<span
class="status ${
    status === "suspended"
        ? "suspended"
        : ""
}"
>

${esc(
    status.toUpperCase()
)}

</span>


<div class="actions">

<button
class="primary"
onclick="openUser('${esc(user.id)}')"
>
Manage
</button>

</div>

</div>

`;

            }
        )
        .join("");

}


// ============================================================
// STATS
// ============================================================

function updateStats() {

    const total =
        users.length;


    const active =
        users.filter(
            user =>
                (
                    user.status ||
                    "active"
                ) === "active"
        ).length;


    const balance =
        users.reduce(
            (
                sum,
                user
            ) =>
                sum +
                Number(
                    user.balance || 0
                ),
            0
        );


    document
    .getElementById(
        "totalUsers"
    )
    .textContent =
        total;


    document
    .getElementById(
        "activeUsers"
    )
    .textContent =
        active;


    document
    .getElementById(
        "totalBalance"
    )
    .textContent =
        money(balance);
}


// ============================================================
// OPEN USER
// ============================================================

async function openUser(id) {

    try {

        const data =
            await api(
                "/api/admin/users/" +
                encodeURIComponent(id)
            );


        selectedUser =
            data.user;


        document
        .getElementById(
            "modal"
        )
        .classList
        .remove("hidden");


        document
        .getElementById(
            "modalUser"
        )
        .innerHTML = `

<div class="small">
Customer
</div>

<div
style="
font-size:18px;
font-weight:700;
margin:5px 0 15px;
"
>
${esc(
    selectedUser.email ||
    selectedUser.phone ||
    selectedUser.id
)}
</div>

<div class="small">
User ID
</div>

<div
style="
word-break:break-all;
margin:5px 0 15px;
"
>
${esc(
    selectedUser.id
)}
</div>

<div class="small">
Current Balance
</div>

<div
style="
font-size:28px;
font-weight:800;
margin-top:5px;
"
>
${money(
    selectedUser.balance
)}
</div>

`;


        document
        .getElementById(
            "modalMessage"
        )
        .innerHTML = "";


        renderTransactions();


    } catch (error) {

        showMessage(
            error.message,
            true
        );

    }
}


// ============================================================
// CLOSE MODAL
// ============================================================

function closeModal() {

    selectedUser =
        null;


    document
    .getElementById(
        "modal"
    )
    .classList
    .add("hidden");

}


// ============================================================
// CHANGE BALANCE
// ============================================================

async function changeBalance() {

    if (!selectedUser) {
        return;
    }


    const type =
        document
        .getElementById(
            "balanceType"
        )
        .value;


    const amount =
        Number(
            document
            .getElementById(
                "amount"
            )
            .value
        );


    const reason =
        document
        .getElementById(
            "reason"
        )
        .value
        .trim();


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        showModalMessage(
            "Enter a valid amount.",
            true
        );

        return;
    }


    if (!reason) {

        showModalMessage(
            "Enter a reason.",
            true
        );

        return;
    }


    const action =
        type === "credit"
            ? "increase"
            : "decrease";


    if (
        !confirm(
            "Confirm " +
            action +
            " of " +
            money(amount) +
            " for this account?"
        )
    ) {

        return;

    }


    try {

        const data =
            await api(
                "/api/admin/users/" +
                encodeURIComponent(
                    selectedUser.id
                ) +
                "/balance",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            amount,
                            type,
                            reason
                        })
                }
            );


        selectedUser =
            data.user;


        showModalMessage(
            "Balance updated successfully.",
            false
        );


        document
        .getElementById(
            "amount"
        )
        .value = "";


        document
        .getElementById(
            "reason"
        )
        .value = "";


        await loadUsers();


        renderTransactions();


        document
        .getElementById(
            "modalUser"
        )
        .innerHTML = `

<div class="small">
Customer
</div>

<div
style="
font-size:18px;
font-weight:700;
margin:5px 0 15px;
"
>
${esc(
    selectedUser.email ||
    selectedUser.phone ||
    selectedUser.id
)}
</div>

<div class="small">
User ID
</div>

<div
style="
word-break:break-all;
margin:5px 0 15px;
"
>
${esc(
    selectedUser.id
)}
</div>

<div class="small">
Current Balance
</div>

<div
style="
font-size:28px;
font-weight:800;
margin-top:5px;
"
>
${money(
    selectedUser.balance
)}
</div>

`;


    } catch (error) {

        showModalMessage(
            error.message,
            true
        );

    }
}


// ============================================================
// STATUS
// ============================================================

async function changeStatus(status) {

    if (!selectedUser) {
        return;
    }


    if (
        !confirm(
            "Change account status to " +
            status +
            "?"
        )
    ) {

        return;

    }


    try {

        const data =
            await api(
                "/api/admin/users/" +
                encodeURIComponent(
                    selectedUser.id
                ) +
                "/status",
                {
                    method:
                        "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status
                        })
                }
            );


        selectedUser =
            data.user;


        showModalMessage(
            "Account status updated.",
            false
        );


        await loadUsers();


    } catch (error) {

        showModalMessage(
            error.message,
            true
        );

    }
}


// ============================================================
// TRANSACTIONS
// ============================================================

function renderTransactions() {

    const box =
        document
        .getElementById(
            "transactions"
        );


    if (!selectedUser) {

        box.innerHTML = "";

        return;

    }


    const records =
        Array.isArray(
            selectedUser.transactions
        )
            ? selectedUser.transactions
            : [];


    if (!records.length) {

        box.innerHTML = `

<div class="small">
No transactions.
</div>

`;

        return;

    }


    box.innerHTML = `

<div
style="
overflow-x:auto;
max-height:300px;
overflow-y:auto;
"
>

<table>

<thead>

<tr>

<th>
Type
</th>

<th>
Amount
</th>

<th>
Reason
</th>

<th>
Time
</th>

</tr>

</thead>

<tbody>

${
    records
    .slice()
    .reverse()
    .map(
        record => `

<tr>

<td>
${esc(
    record.type ||
    ""
)}
</td>

<td>
${money(
    record.amount
)}
</td>

<td>
${esc(
    record.reason ||
    ""
)}
</td>

<td>
${esc(
    record.time
        ? new Date(
            record.time
        ).toLocaleString()
        : ""
)}
</td>

</tr>

`
    )
    .join("")
}

</tbody>

</table>

</div>

`;

}


// ============================================================
// MESSAGES
// ============================================================

function showMessage(
    message,
    error
) {

    const box =
        document
        .getElementById(
            "message"
        );


    box.className =
        error
            ? "error"
            : "success";


    box.textContent =
        message;

}


function showModalMessage(
    message,
    error
) {

    const box =
        document
        .getElementById(
            "modalMessage"
        );


    box.className =
        error
            ? "error"
            : "success";


    box.textContent =
        message;

}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    token = "";

    sessionStorage.removeItem(
        "nm_admin_token"
    );

    location.reload();

}


// ============================================================
// AUTO LOGIN CHECK
// ============================================================

async function checkSession() {

    if (!token) {
        return;
    }


    try {

        await loadUsers();


        document
        .getElementById(
            "loginScreen"
        )
        .classList
        .add("hidden");


        document
        .getElementById(
            "app"
        )
        .classList
        .remove("hidden");


    } catch {

        logout();

    }

}


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
    () => {

        if (
            token &&
            !document
            .getElementById(
                "app"
            )
            .classList
            .contains("hidden")
        ) {

            loadUsers();

        }

    },
    15000
);


// ============================================================
// START
// ============================================================

checkSession();

</script>

</body>

</html>`;
}


// ============================================================
// LOCAL ADMIN SERVER
// ============================================================

const server =
    http.createServer(
        async (req, res) => {

            const url =
                new URL(
                    req.url,
                    "http://127.0.0.1:" +
                    PORT
                );


            const p =
                url.pathname;


            // ====================================================
            // OPTIONS
            // ====================================================

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


            // ====================================================
            // ADMIN LOGIN
            // ====================================================

            if (
                req.method === "POST" &&
                p === "/api/admin/login"
            ) {

                try {

                    const data =
                        await readBody(req);


                    const result =
                        await liveRequest(
                            "POST",
                            "/api/admin/login",
                            "",
                            data
                        );


                    return sendJSON(
                        res,
                        result.status,
                        result.data
                    );


                } catch (error) {

                    console.error(
                        "Admin login:",
                        error
                    );


                    return sendJSON(
                        res,
                        502,
                        {
                            error:
                                "Could not connect to live Render server."
                        }
                    );

                }

            }


            // ====================================================
            // ADMIN USERS
            // ====================================================

            if (
                req.method === "GET" &&
                p === "/api/admin/users"
            ) {

                const token =
                    String(
                        req.headers.authorization ||
                        ""
                    )
                    .replace(
                        /^Bearer\s+/i,
                        ""
                    );


                if (!token) {

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

                    const search =
                        url.searchParams.get(
                            "q"
                        );


                    const route =
                        search
                            ? "/api/admin/users?q=" +
                              encodeURIComponent(
                                  search
                              )
                            : "/api/admin/users";


                    const result =
                        await liveRequest(
                            "GET",
                            route,
                            token
                        );


                    return sendJSON(
                        res,
                        result.status,
                        result.data
                    );


                } catch (error) {

                    console.error(
                        "Users:",
                        error
                    );


                    return sendJSON(
                        res,
                        502,
                        {
                            error:
                                "Could not connect to live Render server."
                        }
                    );

                }

            }


            // ====================================================
            // ADMIN SINGLE USER
            // ====================================================

            const userMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)$/
                );


            if (
                req.method === "GET" &&
                userMatch
            ) {

                const token =
                    String(
                        req.headers.authorization ||
                        ""
                    )
                    .replace(
                        /^Bearer\s+/i,
                        ""
                    );


                if (!token) {

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
                            userMatch[1]
                        );


                    const result =
                        await liveRequest(
                            "GET",
                            "/api/admin/users/" +
                            encodeURIComponent(id),
                            token
                        );


                    return sendJSON(
                        res,
                        result.status,
                        result.data
                    );


                } catch (error) {

                    return sendJSON(
                        res,
                        502,
                        {
                            error:
                                "Could not connect to live server."
                        }
                    );

                }

            }


            // ====================================================
            // ADMIN BALANCE
            // ====================================================

            const balanceMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/balance$/
                );


            if (
                req.method === "POST" &&
                balanceMatch
            ) {

                const token =
                    String(
                        req.headers.authorization ||
                        ""
                    )
                    .replace(
                        /^Bearer\s+/i,
                        ""
                    );


                if (!token) {

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
                            balanceMatch[1]
                        );


                    const data =
                        await readBody(req);


                    const result =
                        await liveRequest(
                            "POST",
                            "/api/admin/users/" +
                            encodeURIComponent(id) +
                            "/balance",
                            token,
                            data
                        );


                    return sendJSON(
                        res,
                        result.status,
                        result.data
                    );


                } catch (error) {

                    console.error(
                        "Balance:",
                        error
                    );


                    return sendJSON(
                        res,
                        502,
                        {
                            error:
                                error.message
                        }
                    );

                }

            }


            // ====================================================
            // ADMIN STATUS
            // ====================================================

            const statusMatch =
                p.match(
                    /^\/api\/admin\/users\/([^/]+)\/status$/
                );


            if (
                req.method === "PATCH" &&
                statusMatch
            ) {

                const token =
                    String(
                        req.headers.authorization ||
                        ""
                    )
                    .replace(
                        /^Bearer\s+/i,
                        ""
                    );


                if (!token) {

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
                            statusMatch[1]
                        );


                    const data =
                        await readBody(req);


                    const result =
                        await liveRequest(
                            "PATCH",
                            "/api/admin/users/" +
                            encodeURIComponent(id) +
                            "/status",
                            token,
                            data
                        );


                    return sendJSON(
                        res,
                        result.status,
                        result.data
                    );


                } catch (error) {

                    return sendJSON(
                        res,
                        502,
                        {
                            error:
                                error.message
                        }
                    );

                }

            }


            // ====================================================
            // ADMIN PAGE
            // ====================================================

            if (
                req.method === "GET" &&
                (
                    p === "/" ||
                    p === "/admin.html"
                )
            ) {

                return sendHTML(
                    res,
                    adminPage()
                );

            }


            // ====================================================
            // 404
            // ====================================================

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


// ============================================================
// ERROR
// ============================================================

server.on(
    "error",
    error => {

        console.error(
            "Admin server error:",
            error
        );

    }
);


// ============================================================
// START
// ============================================================

server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "Noon Market Admin Panel"
        );

        console.log(
            "http://127.0.0.1:" +
            PORT +
            "/admin.html"
        );

        console.log(
            "Live Server:"
        );

        console.log(
            LIVE_SERVER
        );

        console.log(
            "======================================"
        );

    }
);
