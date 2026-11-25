HazyEats - full-stack version
=============================

Multi-store food delivery for Hazyview and Shabalala, by ZikCode.
React front end, Node.js + Express back end, SQLite database.

What changed from the single HTML file
--------------------------------------
- Accounts, stores, menus and orders now live in a real database on the server, not in the browser.
- Passwords are hashed (bcrypt). Sessions use an httpOnly cookie. The server checks the role on every request.
- Prices are always calculated on the server. The browser cannot change what an order costs.
- Nobody can sign up as admin. Store sign-ups wait for admin approval before they appear to customers.
- Orders reach each store automatically. Store, driver and buyer screens refresh every few seconds.
- A driver can only accept an order after every store has marked its food ready, and only one driver can win it.

Run it on your PC
-----------------
Requires Node.js 20 or newer (https://nodejs.org).

1. Open a terminal in this folder.
2. Install everything:        npm install
                              npm run setup
3. Create the server settings:
                              copy server\.env.example server\.env      (Windows)
                              cp server/.env.example server/.env        (Mac/Linux)
4. Start the app:             npm run dev
5. Open http://localhost:5173

Demo accounts (password Demo@1234): buyer@hazyeats.demo, driver@hazyeats.demo,
store@hazyeats.demo (owns KFC), admin@hazyeats.demo. The sign-in window has one-tap buttons for them.

Run the tests
-------------
    npm test

Put it online (one server, one address)
---------------------------------------
1. npm run build
2. In server/.env set NODE_ENV=production, a long random JWT_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD.
   Set SEED_DEMO=false for a real launch. Set COOKIE_SECURE=true once you use HTTPS.
   Set TRUST_PROXY=1 if the app sits behind nginx, Caddy or Cloudflare.
3. npm start
The server then serves the React app and the API together on PORT (default 3001).
Back up server/data/hazyeats.db regularly. It holds everything.

Google sign-in
--------------
1. In Google Cloud Console create an OAuth client of type "Web application".
2. Add your site address (and http://localhost:5173 for testing) under Authorised JavaScript origins.
3. Put the Client ID in server/.env as GOOGLE_CLIENT_ID and restart.
The Continue with Google button then appears in the sign-in window. Without a Client ID it stays hidden.

How the roles work
------------------
Customer   Browse stores, fill one bag from several stores, check out, follow the order, cancel before a store accepts.
Store      Accept orders, mark ready, edit menu and prices, mark items sold out, open or close the store.
Driver     Go online or offline, see waiting orders, accept a ready order, confirm delivery, see earnings.
Admin      Approve or hide stores, link a store to its owner account by email, onboard vendors, suspend users, see all orders.

To give Zakhele's or Mama Zodwa's a login: the owner signs up as a store, then in Admin > Stores type
their email next to the existing store and press Save.

Not included yet
----------------
- Online payment. Orders are cash on delivery.
- Push or SMS alerts. Screens refresh by polling every few seconds.
- Password reset by email.
- Store logos are linked from the original websites. Replace them with files you are allowed to use.
