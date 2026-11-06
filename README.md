# MileDesk mobile

The customer and delivery partner apps share one Expo and TypeScript codebase. The build role changes the app name and package identifier. Each role has its own screens and local session storage.

## Local setup

Run the MileDesk web app and PostgreSQL first. Apply migrations with `npm run db:setup` in the web repository. Copy `.env.example` to `.env.local` in this repository. Replace `192.168.1.10` with the computer's LAN address. The phone and computer must be on the same network. Start Next.js with `npm run dev -- --hostname 0.0.0.0` and use that LAN address as `APP_ORIGIN` when creating customer links from a phone.

```powershell
npm install
$env:EXPO_PUBLIC_APP_ROLE = 'partner'
npm start
```

Stop Metro before switching `EXPO_PUBLIC_APP_ROLE` to `customer`. Expo inlines `EXPO_PUBLIC_API_URL` into the app bundle; it is a server address, never a secret. Use HTTPS for hosted builds.

Run `npm run icons` after changing the brand mark or palette. The generated customer and partner icons are committed with the app.

## Partner flow

The business owner invites a driver from `/team` in the web app. The driver joins with a name and password, then signs in to MileDesk Partner. The app shows only deliveries assigned to that driver account. It can open the address in Maps, call the customer, record pickup, transit and delivery, or report a failed attempt with a reason. Changes require a network connection. Session tokens are stored with Expo SecureStore on native devices. Removing a driver or resetting their password ends their mobile sessions.

## Customer flow

The dispatcher creates a private tracking link from a delivery in `/live` and shares it with the recipient. The customer can open the link in a browser without installing an app. In the customer app, the recipient pastes the same link to see status and submit an address correction before pickup. The app stores one link on the device. Creating a new link in the web app invalidates the previous link. Links expire after 30 days.

## Limits

No live GPS, ETA, route optimization, push notifications, delivery proof, offline update queue, customer ordering, or payments are connected. The customer link is a bearer credential; share it only with its recipient. Real device navigation, calling, network loss and release builds still need testing. `eas.json` contains internal Android APK profiles for both roles. EAS builds require an Expo account, project setup and `EXPO_PUBLIC_API_URL` for the target environment.
