# MileDesk mobile

Two Expo application variants share the same design and UI code. Customer and partner builds have separate Android package names and iOS bundle identifiers.

## Run locally

```powershell
npm install
$env:EXPO_PUBLIC_APP_ROLE = 'customer'
npm start
```

For the delivery partner app, set `EXPO_PUBLIC_APP_ROLE` to `partner` before starting Metro. Stop the existing server before switching roles. Open the project with an Expo Go version compatible with this project's SDK, or use an emulator/development build.

## Current flows

Customer: order list, delivery progress, entrance details, address editing, account preview.

Partner: shift availability, assigned stops, external Maps handoff, pickup and delivery status updates, failed attempt reason, account preview.

This is an interactive design preview with fictional Salem destinations. Data stays in component state and resets when the app reloads. The two variants do not synchronize. Authentication, shared APIs, persistent/offline storage, actual tracking, notifications, delivery proof and native device testing remain to be implemented.

`eas.json` defines internal Android APK profiles named `customer` and `partner`. Building with EAS requires an Expo account and project configuration. No binaries have been published.
