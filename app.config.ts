const partner = process.env.EXPO_PUBLIC_APP_ROLE === 'partner';
const config = { expo: {
  name: partner ? 'MileDesk Partner' : 'MileDesk',
  slug: partner ? 'miledesk-partner' : 'miledesk-customer',
  version: '0.1.0', orientation: 'portrait', userInterfaceStyle: 'light',
  scheme: partner ? 'miledesk-partner' : 'miledesk',
  ios: { bundleIdentifier: partner ? 'app.miledesk.partner' : 'app.miledesk.customer', supportsTablet: true },
  android: { package: partner ? 'app.miledesk.partner' : 'app.miledesk.customer' },
} };

export default config;
