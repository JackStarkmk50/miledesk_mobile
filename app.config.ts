const partner = process.env.EXPO_PUBLIC_APP_ROLE === "partner";
const config = {
  expo: {
    name: partner ? "MileDesk Partner" : "MileDesk",
    slug: partner ? "miledesk-partner" : "miledesk-customer",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: partner ? "./assets/partner-icon.png" : "./assets/customer-icon.png",
    scheme: partner ? "miledesk-partner" : "miledesk",
    ios: {
      bundleIdentifier: partner
        ? "app.miledesk.partner"
        : "app.miledesk.customer",
      supportsTablet: true,
    },
    android: {
      package: partner ? "app.miledesk.partner" : "app.miledesk.customer",
      adaptiveIcon: {
        foregroundImage: partner
          ? "./assets/partner-foreground.png"
          : "./assets/customer-foreground.png",
        backgroundColor: partner ? "#F5F6F0" : "#285B43",
      },
    },
    plugins: ["expo-secure-store"],
  },
};

export default config;
