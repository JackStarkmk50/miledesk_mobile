const partner = process.env.EXPO_PUBLIC_APP_ROLE === "partner";
const config = {
  expo: {
    name: partner ? "MileDesk Partner" : "MileDesk",
    slug: partner ? "miledesk-partner" : "miledesk-customer",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/miledesk-icon.png",
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
        foregroundImage: "./assets/miledesk-foreground.png",
        backgroundColor: "#234C3C",
      },
    },
    plugins: [
      "expo-secure-store",
      "expo-sqlite",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow MileDesk to share your delivery location when you choose to.",
        },
      ],
      ...(partner
        ? [
            [
              "expo-image-picker",
              {
                photosPermission: "Allow MileDesk to select a delivery photo.",
              },
            ],
          ]
        : []),
    ],
  },
};

export default config;
